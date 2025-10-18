import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface AgentCharacter {
  id: string;
  agentId: string;
  screenplayId: string;
  name: string;
  emoji: string;
  position: { x: number, y: number };
  velocity: { x: number, y: number };
  isActive: boolean;
  radius: number;
  color: string;
  trail: { x: number, y: number, alpha: number }[];
  // Temporary push mechanics
  pushedUntil?: number; // Timestamp when push ends (null if not pushed)
  pushedVelocity?: { x: number, y: number }; // Velocity from being pushed
}

@Component({
  selector: 'app-agent-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './agent-game.component.html',
  styleUrls: ['./agent-game.component.css']
})
export class AgentGameComponent implements AfterViewInit, OnDestroy {
  @ViewChild('gameCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private animationFrameId: number = 0;
  private agents: AgentCharacter[] = [];
  private canvasWidth = 0;
  private canvasHeight = 0;
  private lastTime = 0;
  private resizeObserver?: ResizeObserver;

  // Tooltip state
  selectedAgent: AgentCharacter | null = null;
  tooltipX = 0;
  tooltipY = 0;
  showTooltip = false;

  // Agent radius (smaller)
  private readonly AGENT_RADIUS = 12;

  constructor(private http: HttpClient) {}

  ngAfterViewInit(): void {
    this.initCanvas();
    this.loadAgentsFromBFF();
    this.startGameLoop();
    
    // Force resize after a short delay to ensure container is properly sized
    setTimeout(() => {
      this.resizeCanvas();
    }, 100);
    
    // Additional resize after longer delay to ensure full rendering
    setTimeout(() => {
      this.resizeCanvas();
    }, 500);
  }

  ngOnDestroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  private initCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;

    // Set canvas size to match container (full height vertical rectangle)
    this.resizeCanvas();

    // Use ResizeObserver to detect container size changes
    const container = canvas.parentElement;
    if (container && window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => {
        this.resizeCanvas();
      });
      this.resizeObserver.observe(container);
    }

    // Fallback: Handle window resize
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  private resizeCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const container = canvas.parentElement;
    if (container) {
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      
      // Force minimum height to ensure canvas uses full container height
      const minHeight = Math.max(newHeight, 200);
      
      // Only resize if dimensions actually changed
      if (newWidth !== this.canvasWidth || newHeight !== this.canvasHeight) {
        this.canvasWidth = canvas.width = newWidth;
        this.canvasHeight = canvas.height = newHeight;
        
        // Set CSS dimensions to match canvas dimensions
        canvas.style.width = `${newWidth}px`;
        canvas.style.height = `${newHeight}px`;
        
        console.log(`🎮 [AGENT-GAME] Canvas resized to: ${newWidth}x${newHeight}`);
        console.log(`🎮 [AGENT-GAME] Container dimensions: ${container.clientWidth}x${container.clientHeight}`);
        
        // Reposition agents if they're outside the new bounds
        this.agents.forEach(agent => {
          agent.position.x = Math.max(agent.radius, Math.min(this.canvasWidth - agent.radius, agent.position.x));
          agent.position.y = Math.max(agent.radius, Math.min(this.canvasHeight - agent.radius, agent.position.y));
        });
      }
    }
  }

  private async loadAgentsFromBFF(): Promise<void> {
    try {
      // Determine base URL
      const baseUrl = this.getBaseUrl();
      console.log('🎮 [AGENT-GAME] Base URL:', baseUrl);

      // Fetch agent instances from BFF
      const url = `${baseUrl}/api/agents/instances?limit=500`;
      console.log('🎮 [AGENT-GAME] Fetching from:', url);

      const response = await this.http.get<{ success: boolean, count: number, instances: any[] }>(url).toPromise();

      console.log('🎮 [AGENT-GAME] Response received:', response);
      console.log('🎮 [AGENT-GAME] Response type:', typeof response);
      console.log('🎮 [AGENT-GAME] Success:', response?.success);
      console.log('🎮 [AGENT-GAME] Count:', response?.count);
      console.log('🎮 [AGENT-GAME] Instances length:', response?.instances?.length);

      if (response && response.success && response.instances && response.instances.length > 0) {
        console.log('🎮 [AGENT-GAME] Loaded agents from BFF:', response.instances);

        // Clear existing agents
        this.agents = [];

        // Create agent characters from BFF data
        response.instances.forEach((agentData) => {
          this.addAgentFromBFF(agentData);
        });

        console.log(`✅ [AGENT-GAME] Successfully loaded ${this.agents.length} agents from BFF`);
      } else {
        console.warn('⚠️ [AGENT-GAME] No agents found in BFF response, no agents will be displayed');
        console.log('Response was:', response);
        // Clear existing agents instead of creating test agents
        this.agents = [];
      }
    } catch (error) {
      console.error('❌ [AGENT-GAME] Error loading agents from BFF:', error);
      console.error('Error details:', error);
      console.log('🎮 [AGENT-GAME] No agents will be displayed due to error');
      // Clear existing agents instead of creating test agents
      this.agents = [];
    }
  }

  private getBaseUrl(): string {
    // Use environment configuration
    return environment.apiUrl;
  }

  private addAgentFromBFF(agentData: any): void {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DFE6E9', '#74B9FF', '#FD79A8', '#FDCB6E', '#6C5CE7'];

    // Find non-overlapping position
    const position = this.findNonOverlappingPosition();

    const agent: AgentCharacter = {
      id: agentData.instance_id || agentData.id || `agent_${Date.now()}_${Math.random()}`,
      agentId: agentData.agent_id ?? 'unknown',
      screenplayId: agentData.screenplay_id || 'unknown',
      name: agentData.definition?.title || agentData.name || 'Unknown Agent',
      emoji: agentData.emoji || agentData.definition?.emoji || '🤖',
      position: position,
      velocity: {
        x: (Math.random() - 0.5) * 2.25,
        y: (Math.random() - 0.5) * 2.25
      },
      isActive: false,  // Start inactive, will be updated by parent
      radius: this.AGENT_RADIUS,
      color: colors[this.agents.length % colors.length],
      trail: []
    };

    this.agents.push(agent);
    console.log('🎮 [AGENT-GAME] Added agent:', agent.name, agent.emoji);
  }

  private findNonOverlappingPosition(): { x: number, y: number } {
    const maxAttempts = 50;
    const padding = this.AGENT_RADIUS + 5;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = Math.random() * (this.canvasWidth - padding * 2) + padding;
      const y = Math.random() * (this.canvasHeight - padding * 2) + padding;

      // Check if this position overlaps with any existing agent
      let overlaps = false;
      for (const agent of this.agents) {
        const dx = x - agent.position.x;
        const dy = y - agent.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.AGENT_RADIUS * 2 + 10) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        return { x, y };
      }
    }

    // Fallback: return position even if overlapping (rare case)
    return {
      x: Math.random() * (this.canvasWidth - padding * 2) + padding,
      y: Math.random() * (this.canvasHeight - padding * 2) + padding
    };
  }


  private startGameLoop(): void {
    const gameLoop = (timestamp: number) => {
      const deltaTime = timestamp - this.lastTime;
      this.lastTime = timestamp;

      this.update(deltaTime);
      this.render();

      this.animationFrameId = requestAnimationFrame(gameLoop);
    };

    this.animationFrameId = requestAnimationFrame(gameLoop);
  }

  private update(deltaTime: number): void {
    // Update each agent
    this.agents.forEach(agent => {
      if (agent.isActive) {
        // Add current position to trail
        agent.trail.push({
          x: agent.position.x,
          y: agent.position.y,
          alpha: 1.0
        });

        // Limit trail length (performance)
        if (agent.trail.length > 15) {
          agent.trail.shift();
        }

        // Fade trail
        agent.trail.forEach((point, index) => {
          point.alpha = (index + 1) / agent.trail.length * 0.4;
        });

        // Update position
        agent.position.x += agent.velocity.x;
        agent.position.y += agent.velocity.y;

        // Bounce off walls
        if (agent.position.x - agent.radius < 0 || agent.position.x + agent.radius > this.canvasWidth) {
          agent.velocity.x *= -1;
          agent.position.x = Math.max(agent.radius, Math.min(this.canvasWidth - agent.radius, agent.position.x));
        }

        if (agent.position.y - agent.radius < 0 || agent.position.y + agent.radius > this.canvasHeight) {
          agent.velocity.y *= -1;
          agent.position.y = Math.max(agent.radius, Math.min(this.canvasHeight - agent.radius, agent.position.y));
        }

        // Check collision with other agents
        this.agents.forEach(other => {
          if (agent.id !== other.id) {
            const dx = other.position.x - agent.position.x;
            const dy = other.position.y - agent.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minDistance = agent.radius + other.radius;

            if (distance < minDistance) {
              const angle = Math.atan2(dy, dx);
              const sin = Math.sin(angle);
              const cos = Math.cos(angle);

              if (other.isActive) {
                // Both active: bounce off each other
                const vx1 = agent.velocity.x * cos + agent.velocity.y * sin;
                const vy1 = agent.velocity.y * cos - agent.velocity.x * sin;

                agent.velocity.x = -vx1 * cos - vy1 * sin;
                agent.velocity.y = -vy1 * cos + vx1 * sin;
              } else {
                // Active agent pushes inactive agent
                // Apply temporary velocity to inactive agent for 1 second
                const pushSpeed = 3.0; // Speed of push
                other.pushedVelocity = {
                  x: cos * pushSpeed,
                  y: sin * pushSpeed
                };
                other.pushedUntil = Date.now() + 1000; // Push for 1 second

                // Bounce active agent
                agent.velocity.x *= -0.8;
                agent.velocity.y *= -0.8;
              }

              // Separate agents
              const overlap = minDistance - distance;
              agent.position.x -= overlap * cos * 0.5;
              agent.position.y -= overlap * sin * 0.5;

              if (other.isActive) {
                other.position.x += overlap * cos * 0.5;
                other.position.y += overlap * sin * 0.5;
              }
            }
          }
        });

        // Add some randomness to movement
        if (Math.random() < 0.02) {
          agent.velocity.x += (Math.random() - 0.5) * 0.45;
          agent.velocity.y += (Math.random() - 0.5) * 0.45;
        }

        // Limit speed
        const speed = Math.sqrt(agent.velocity.x ** 2 + agent.velocity.y ** 2);
        const maxSpeed = 3.75;
        if (speed > maxSpeed) {
          agent.velocity.x = (agent.velocity.x / speed) * maxSpeed;
          agent.velocity.y = (agent.velocity.y / speed) * maxSpeed;
        }
      } else {
        // Clear trail when inactive (unless being pushed)
        const now = Date.now();
        const isBeingPushed = agent.pushedUntil && agent.pushedUntil > now;

        if (isBeingPushed && agent.pushedVelocity) {
          // Agent is being pushed - apply temporary velocity
          agent.position.x += agent.pushedVelocity.x;
          agent.position.y += agent.pushedVelocity.y;

          // Bounce off walls while being pushed
          if (agent.position.x - agent.radius < 0 || agent.position.x + agent.radius > this.canvasWidth) {
            agent.pushedVelocity.x *= -1;
            agent.position.x = Math.max(agent.radius, Math.min(this.canvasWidth - agent.radius, agent.position.x));
          }

          if (agent.position.y - agent.radius < 0 || agent.position.y + agent.radius > this.canvasHeight) {
            agent.pushedVelocity.y *= -1;
            agent.position.y = Math.max(agent.radius, Math.min(this.canvasHeight - agent.radius, agent.position.y));
          }

          // Check collision with other agents while being pushed
          this.agents.forEach(other => {
            if (agent.id !== other.id) {
              const dx = other.position.x - agent.position.x;
              const dy = other.position.y - agent.position.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              const minDistance = agent.radius + other.radius;

              if (distance < minDistance && agent.pushedVelocity) {
                const angle = Math.atan2(dy, dx);
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);

                // Bounce pushed agent off the obstacle
                agent.pushedVelocity.x *= -0.6; // Reduce velocity on collision
                agent.pushedVelocity.y *= -0.6;

                // Separate agents
                const overlap = minDistance - distance;
                agent.position.x -= overlap * cos;
                agent.position.y -= overlap * sin;
              }
            }
          });

          // Show small trail while being pushed
          agent.trail.push({
            x: agent.position.x,
            y: agent.position.y,
            alpha: 0.5
          });
          if (agent.trail.length > 8) {
            agent.trail.shift();
          }

          // Apply friction to slow down gradually
          agent.pushedVelocity.x *= 0.98;
          agent.pushedVelocity.y *= 0.98;
        } else {
          // Not being pushed - clear trail and reset push state
          agent.trail = [];
          agent.pushedUntil = undefined;
          agent.pushedVelocity = undefined;
        }
      }
    });
  }

  private render(): void {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Draw background
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Draw agents
    this.agents.forEach(agent => {
      // Draw trail
      if (agent.trail.length > 1) {
        this.ctx.beginPath();
        this.ctx.moveTo(agent.trail[0].x, agent.trail[0].y);

        for (let i = 1; i < agent.trail.length; i++) {
          this.ctx.lineTo(agent.trail[i].x, agent.trail[i].y);
        }

        this.ctx.strokeStyle = agent.color;
        this.ctx.lineWidth = 2;
        this.ctx.globalAlpha = 0.3;
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;
      }

      // Draw circle
      this.ctx.beginPath();
      this.ctx.arc(agent.position.x, agent.position.y, agent.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = agent.color;
      this.ctx.fill();

      // Add glow effect if active
      if (agent.isActive) {
        this.ctx.strokeStyle = agent.color;
        this.ctx.lineWidth = 2;
        this.ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 200) * 0.3;
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;
      }

      // Draw emoji
      this.ctx.font = '16px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(agent.emoji, agent.position.x, agent.position.y);
    });
  }

  onCanvasClick(event: MouseEvent): void {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Check if click is on any agent
    for (const agent of this.agents) {
      const dx = x - agent.position.x;
      const dy = y - agent.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < agent.radius) {
        this.selectedAgent = agent;
        this.tooltipX = event.clientX;
        this.tooltipY = event.clientY;
        this.showTooltip = true;
        return;
      }
    }

    // Click outside agents - hide tooltip
    this.showTooltip = false;
  }

  closeTooltip(): void {
    this.showTooltip = false;
    this.selectedAgent = null;
  }

  // Public method to update agent status from parent component
  public setAgentActive(instanceId: string, isActive: boolean): void {
    const agent = this.agents.find(a => a.id === instanceId);
    if (agent) {
      console.log(`🎮 [AGENT-GAME] Setting agent ${agent.name} (${instanceId}) to ${isActive ? 'ACTIVE' : 'INACTIVE'}`);
      agent.isActive = isActive;
    } else {
      console.warn(`⚠️ [AGENT-GAME] Agent with instanceId ${instanceId} not found`);
    }
  }

  // Public method to add new agent
  public addAgent(agentData: { emoji: string, name: string, agentId: string, screenplayId: string, instanceId?: string }): void {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DFE6E9', '#74B9FF'];
    const position = this.findNonOverlappingPosition();

    this.agents.push({
      id: agentData.instanceId || `agent_${Date.now()}`,
      agentId: agentData.agentId,
      screenplayId: agentData.screenplayId,
      name: agentData.name,
      emoji: agentData.emoji,
      position: position,
      velocity: {
        x: (Math.random() - 0.5) * 2.25,
        y: (Math.random() - 0.5) * 2.25
      },
      isActive: false,
      radius: this.AGENT_RADIUS,
      color: colors[Math.floor(Math.random() * colors.length)],
      trail: []
    });
  }

  // Public method to reload agents from BFF
  public async reloadAgents(): Promise<void> {
    await this.loadAgentsFromBFF();
  }

  // Public method to clear all agents immediately
  public clearAllAgents(): void {
    console.log('🎮 [AGENT-GAME] Clearing all agents immediately');
    this.agents = [];
  }

  // Public method to remove an agent by instance ID
  public removeAgent(instanceId: string): void {
    const index = this.agents.findIndex(a => a.id === instanceId);
    if (index !== -1) {
      const removedAgent = this.agents[index];
      this.agents.splice(index, 1);
      console.log(`🎮 [AGENT-GAME] Removed agent ${removedAgent.name} (${instanceId})`);
    } else {
      console.warn(`⚠️ [AGENT-GAME] Agent with instanceId ${instanceId} not found`);
    }
  }
}
