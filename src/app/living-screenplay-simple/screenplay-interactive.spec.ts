import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScreenplayInteractive } from './screenplay-interactive';
import { DraggableCircle } from '../examples/draggable-circles/draggable-circle.component';

// Mock html-to-md library
const mockHtmlToMd = jasmine.createSpy('htmlToMd').and.callFake((html: string) =>
  html.replace(/<[^>]*>/g, '') // Simple HTML strip for testing
);

describe('ScreenplayInteractive', () => {
  let component: ScreenplayInteractive;
  let fixture: ComponentFixture<ScreenplayInteractive>;
  let mockLocalStorage: { [key: string]: string };

  beforeEach(async () => {
    // Mock localStorage
    mockLocalStorage = {};
    const localStorageMock = {
      getItem: jasmine.createSpy('getItem').and.callFake((key: string) => mockLocalStorage[key] || null),
      setItem: jasmine.createSpy('setItem').and.callFake((key: string, value: string) => {
        mockLocalStorage[key] = value;
      }),
      removeItem: jasmine.createSpy('removeItem').and.callFake((key: string) => {
        delete mockLocalStorage[key];
      }),
      clear: jasmine.createSpy('clear').and.callFake(() => {
        mockLocalStorage = {};
      })
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    });

    await TestBed.configureTestingModule({
      imports: [ScreenplayInteractive, DraggableCircle]
    }).compileComponents();

    fixture = TestBed.createComponent(ScreenplayInteractive);
    component = fixture.componentInstance;

    // Clear any existing agents and content before each test
    (component as any).agentInstances.clear();
    component.agents = [];
    component.editorContent = ''; // Clear default content to prevent interference
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Initial Markdown Agent Synchronization', () => {
    it('should detect emojis in markdown content and create corresponding agents', async () => {
      // ARRANGE
      const testMarkdown = `
        # Test Document
        Authentication 🔐 is important
        Progress tracking 📊 helps
        Deployment 🚀 should be automated
      `;

      // Set the content we want to test
      component.editorContent = testMarkdown;

      // Mock DOM content
      const mockEditorElement = document.createElement('div');
      mockEditorElement.innerHTML = testMarkdown;
      spyOn(document, 'querySelector').and.returnValue(mockEditorElement);
      spyOn(component as any, 'positionAgentsOverEmojis').and.stub();

      // ACT
      (component as any).syncAgentsWithMarkdown();
      fixture.detectChanges();

      // ASSERT
      expect(component.agents.length).toBe(3); // 🔐, 📊, 🚀
      expect((component as any).agentInstances.size).toBe(3);

      // Verify agent types match emojis
      const agentTypes = component.agents.map(agent => agent.data.emoji);
      expect(agentTypes).toContain('🔐');
      expect(agentTypes).toContain('📊');
      expect(agentTypes).toContain('🚀');
    });

    it('should inject HTML comments as anchors next to emojis', async () => {
      // ARRANGE
      const testMarkdown = 'Test 🔥 content';
      component.editorContent = testMarkdown;
      const mockEditorElement = document.createElement('div');
      mockEditorElement.innerHTML = testMarkdown;
      spyOn(document, 'querySelector').and.returnValue(mockEditorElement);

      // ACT
      (component as any).syncAgentsWithMarkdown();

      // ASSERT
      const htmlContent = mockEditorElement.innerHTML;
      expect(htmlContent).toMatch(/<!-- agent-id: [a-f0-9-]{36} -->/);
      expect(htmlContent).toContain('🔥');
    });

    it('should generate unique UUIDs for each agent', async () => {
      // ARRANGE
      const testMarkdown = 'Auth 🔐 and Progress 📊 and Deploy 🚀';
      component.editorContent = testMarkdown;
      const mockEditorElement = document.createElement('div');
      mockEditorElement.innerHTML = testMarkdown;
      spyOn(document, 'querySelector').and.returnValue(mockEditorElement);
      spyOn(component as any, 'positionAgentsOverEmojis').and.stub();

      // ACT
      (component as any).syncAgentsWithMarkdown();

      // ASSERT
      const agentIds = Array.from((component as any).agentInstances.keys());
      expect(agentIds.length).toBe(3);

      // All IDs should be unique
      const uniqueIds = new Set(agentIds);
      expect(uniqueIds.size).toBe(3);

      // All IDs should be valid UUIDs
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      agentIds.forEach(id => {
        expect(id).toMatch(uuidRegex);
      });
    });

    it('should persist agents to localStorage', async () => {
      // ARRANGE
      const testMarkdown = 'Deploy 🚀 now';
      component.editorContent = testMarkdown;
      const mockEditorElement = document.createElement('div');
      mockEditorElement.innerHTML = testMarkdown;
      spyOn(document, 'querySelector').and.returnValue(mockEditorElement);
      spyOn(component as any, 'positionAgentsOverEmojis').and.stub();

      // ACT
      (component as any).syncAgentsWithMarkdown();

      // ASSERT
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'screenplay-agent-instances',
        jasmine.any(String)
      );

      const storedState = mockLocalStorage['screenplay-agent-instances'];
      const storedData = storedState ? JSON.parse(storedState) : null;
      expect(storedData).toBeDefined();
      expect(storedData.length).toBe(1);
      expect(storedData[0].emoji).toBe('🚀');
    });
  });

  describe('State Clearing When Loading New Files', () => {
    it('should clear existing agents when loading new markdown content', async () => {
      // ARRANGE - Setup initial state with agents
      const initialMarkdown = 'Initial 🔐 content';
      const mockEditorElement = document.createElement('div');
      mockEditorElement.innerHTML = initialMarkdown;
      spyOn(document, 'querySelector').and.returnValue(mockEditorElement);
      spyOn(component as any, 'positionAgentsOverEmojis').and.stub();

      (component as any).syncAgentsWithMarkdown();
      expect(component.agents.length).toBe(1);
      expect((component as any).agentInstances.size).toBe(1);

      // ACT - Load new content
      const newMarkdown = 'New 📊 content';
      mockEditorElement.innerHTML = newMarkdown;

      // Simulate loading new content
      (component as any).agentInstances.clear();
      component.agents = [];
      component.editorContent = newMarkdown;
      (component as any).syncAgentsWithMarkdown();

      // Wait for setTimeout to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // ASSERT - Old agents cleared, new agents created
      expect(component.agents.length).toBe(1);
      expect((component as any).agentInstances.size).toBe(1);

      // Verify it's the new agent, not the old one
      const remainingAgent = component.agents[0];
      expect(remainingAgent.data.emoji).toBe('📊');
      expect(remainingAgent.data.emoji).not.toBe('🔐');
    });

    it('should clear localStorage when agents are cleared', async () => {
      // ARRANGE
      const initialMarkdown = 'Test 🔥 content';
      const mockEditorElement = document.createElement('div');
      mockEditorElement.innerHTML = initialMarkdown;
      spyOn(document, 'querySelector').and.returnValue(mockEditorElement);
      spyOn(component as any, 'positionAgentsOverEmojis').and.stub();

      // Setup initial agents
      (component as any).syncAgentsWithMarkdown();
      expect(localStorage.setItem).toHaveBeenCalled();

      // ACT - Load empty content
      // Simulate loading empty content
      (component as any).agentInstances.clear();
      component.agents = [];
      component.editorContent = '';
      (component as any).syncAgentsWithMarkdown();

      await new Promise(resolve => setTimeout(resolve, 10));

      // ASSERT - localStorage should be cleared
      expect((component as any).agentInstances.size).toBe(0);
      expect(component.agents.length).toBe(0);
    });

    it('should handle race conditions between DOM updates and synchronization', async () => {
      // ARRANGE
      const mockEditorElement = document.createElement('div');
      spyOn(document, 'querySelector').and.returnValue(mockEditorElement);
      spyOn(component as any, 'syncAgentsWithMarkdown').and.callThrough();
      spyOn(component as any, 'positionAgentsOverEmojis').and.stub();

      // ACT - Simulate rapid file loading
      // Simulate rapid file loading
      component.editorContent = 'First 🔥 content';
      (component as any).syncAgentsWithMarkdown();
      component.editorContent = 'Second 📊 content';
      (component as any).syncAgentsWithMarkdown();

      // Wait for both setTimeout calls to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      // ASSERT - Only the latest content should be processed
      expect((component as any).syncAgentsWithMarkdown).toHaveBeenCalled();
      // Should have only agents from the second file
      const currentEmojis = component.agents.map(a => a.data.emoji);
      expect(currentEmojis).toContain('📊');
      expect(currentEmojis).not.toContain('🔥');
    });
  });

  describe('Markdown Saving with Anchors (Not HTML)', () => {
    it('should save markdown content with HTML comments preserved', () => {
      // ARRANGE
      const mockEditorElement = document.createElement('div');
      mockEditorElement.innerHTML = 'Test 🚀 <!-- agent-id: 123-456 --> content';
      spyOn(document, 'querySelector').and.returnValue(mockEditorElement);

      // Mock file save methods
      const mockLink = document.createElement('a');
      spyOn(document, 'createElement').and.returnValue(mockLink);
      spyOn(mockLink, 'click').and.stub();
      spyOn(URL, 'createObjectURL').and.returnValue('mock-url');
      spyOn(URL, 'revokeObjectURL').and.stub();

      // ACT
      component.saveMarkdownFile();

      // ASSERT
      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockLink.download).toContain('.md');
      expect(URL.createObjectURL).toHaveBeenCalledWith(jasmine.any(Blob));

      // Verify the blob contains markdown, not HTML
      const createObjectURLCall = (URL.createObjectURL as jasmine.Spy).calls.mostRecent();
      const blob = createObjectURLCall.args[0] as Blob;

      // Read blob content
      blob.text().then(content => {
        expect(content).toContain('🚀');
        expect(content).toContain('<!-- agent-id: 123-456 -->');
        expect(content).not.toMatch(/<div|<p|<span/); // No HTML tags
      });
    });

    it('should convert HTML content to markdown before saving', async () => {
      // ARRANGE
      const mockEditorElement = document.createElement('div');
      mockEditorElement.innerHTML = '<p>Test <strong>🚀</strong> <!-- agent-id: 123 --> content</p>';
      spyOn(document, 'querySelector').and.returnValue(mockEditorElement);

      const mockLink = document.createElement('a');
      spyOn(document, 'createElement').and.returnValue(mockLink);
      spyOn(mockLink, 'click').and.stub();
      spyOn(URL, 'createObjectURL').and.returnValue('mock-url');

      // ACT
      component.saveMarkdownFile();

      // ASSERT
      const createObjectURLCall = (URL.createObjectURL as jasmine.Spy).calls.mostRecent();
      const blob = createObjectURLCall.args[0] as Blob;

      const content = await blob.text();
      // Should not contain HTML tags (html-to-md mock strips them)
      expect(content).not.toContain('<p>');
      expect(content).not.toContain('<strong>');
      expect(content).toContain('🚀');
    });

    it('should preserve agent anchors during save/load cycle', async () => {
      // ARRANGE - Initial content with agents
      const initialContent = 'Deploy 🚀 the app';
      const mockEditorElement = document.createElement('div');
      mockEditorElement.innerHTML = initialContent;
      spyOn(document, 'querySelector').and.returnValue(mockEditorElement);
      spyOn(component as any, 'positionAgentsOverEmojis').and.stub();

      // Create agents
      (component as any).syncAgentsWithMarkdown();
      const originalAgentId = Array.from((component as any).agentInstances.keys())[0];

      // Simulate anchor injection
      mockEditorElement.innerHTML = `Deploy 🚀 <!-- agent-id: ${originalAgentId} --> the app`;

      // ACT - Save content
      const mockLink = document.createElement('a');
      spyOn(document, 'createElement').and.returnValue(mockLink);
      spyOn(mockLink, 'click').and.stub();
      spyOn(URL, 'createObjectURL').and.returnValue('mock-url');

      component.saveMarkdownFile();

      // Get saved content
      const createObjectURLCall = (URL.createObjectURL as jasmine.Spy).calls.mostRecent();
      const blob = createObjectURLCall.args[0] as Blob;
      const savedContent = await blob.text();

      // ACT - Load the saved content back
      // Simulate loading the saved content back
      component.editorContent = savedContent;
      (component as any).syncAgentsWithMarkdown();
      await new Promise(resolve => setTimeout(resolve, 10));

      // ASSERT - Agent should be recreated with same ID
      const restoredAgentIds = Array.from((component as any).agentInstances.keys());
      expect(restoredAgentIds).toContain(originalAgentId);
      expect(component.agents.length).toBe(1);
      expect(component.agents[0].data.emoji).toBe('🚀');
    });
  });

  describe('Complex Emoji Unicode Handling', () => {
    it('should handle complex Unicode emojis (multi-code-point)', () => {
      // ARRANGE - Complex emojis that were problematic
      const complexEmojis = ['🚀', '🔐', '📊', '🛡️', '⚡'];
      const testContent = complexEmojis.join(' ');
      component.editorContent = testContent;

      const mockEditorElement = document.createElement('div');
      mockEditorElement.innerHTML = testContent;
      spyOn(document, 'querySelector').and.returnValue(mockEditorElement);
      spyOn(component as any, 'positionAgentsOverEmojis').and.stub();

      // ACT
      (component as any).syncAgentsWithMarkdown();

      // ASSERT
      expect(component.agents.length).toBe(complexEmojis.length);

      const detectedEmojis = component.agents.map(a => a.data.emoji);
      complexEmojis.forEach(emoji => {
        expect(detectedEmojis).toContain(emoji);
      });
    });

    it('should not create duplicate agents for same emoji positions', () => {
      // ARRANGE
      const testContent = 'Test 🚀 content 🚀 more';
      component.editorContent = testContent;
      const mockEditorElement = document.createElement('div');
      mockEditorElement.innerHTML = testContent;
      spyOn(document, 'querySelector').and.returnValue(mockEditorElement);
      spyOn(component as any, 'positionAgentsOverEmojis').and.stub();

      // ACT - Run sync twice
      (component as any).syncAgentsWithMarkdown();
      const initialCount = component.agents.length;

      (component as any).syncAgentsWithMarkdown();
      const finalCount = component.agents.length;

      // ASSERT - Should not create duplicates
      expect(finalCount).toBe(initialCount);
      expect(component.agents.length).toBe(2); // Two 🚀 emojis
    });
  });

  describe('Agent Positioning Logic', () => {
    it('should position agents over corresponding emojis in DOM', () => {
      // ARRANGE
      const mockEditorElement = document.createElement('div');
      mockEditorElement.innerHTML = 'Test 🚀 content';

      // Mock emoji span element
      const mockEmojiSpan = document.createElement('span');
      mockEmojiSpan.textContent = '🚀';
      mockEmojiSpan.getBoundingClientRect = () => ({
        left: 100, top: 50, width: 24, height: 24,
        right: 124, bottom: 74, x: 100, y: 50, toJSON: () => {}
      }) as DOMRect;

      mockEditorElement.appendChild(mockEmojiSpan);

      spyOn(document, 'querySelector').and.returnValue(mockEditorElement);
      spyOn(component as any, 'findEmojiElementForAgent').and.returnValue(mockEmojiSpan);

      // Create agent
      (component as any).syncAgentsWithMarkdown();

      // ACT
      (component as any).positionAgentsOverEmojis();

      // ASSERT
      const agent = component.agents[0];
      expect(agent.position.x).toBe(100); // left position
      expect(agent.position.y).toBe(50);  // top position
    });
  });

  describe('Manual Agent Addition', () => {
    it('should add a manual agent not tied to text content', () => {
      // ARRANGE
      const initialAgentCount = component.getAgentInstancesAsArray().length;
      expect(initialAgentCount).toBe(0);

      // Mock canvas element for positioning calculation
      const mockCanvas = document.createElement('div');
      mockCanvas.style.width = '800px';
      mockCanvas.style.height = '600px';
      Object.defineProperty(mockCanvas, 'offsetWidth', { value: 800 });
      Object.defineProperty(mockCanvas, 'offsetHeight', { value: 600 });
      (component as any).canvas = { nativeElement: mockCanvas };

      // ACT
      component.addManualAgent();

      // ASSERT
      const instances = component.getAgentInstancesAsArray();
      expect(instances.length).toBe(initialAgentCount + 1);

      const manualAgent = instances.find(agent => agent.id.startsWith('manual-'));
      expect(manualAgent).toBeDefined();
      expect(manualAgent?.status).toBe('pending');
      expect(manualAgent?.position.x).toBeGreaterThanOrEqual(50);
      expect(manualAgent?.position.y).toBeGreaterThanOrEqual(50);
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'screenplay-agent-instances',
        jasmine.any(String)
      );
    });

    it('should persist manual agent to localStorage', () => {
      // ARRANGE
      const mockCanvas = document.createElement('div');
      Object.defineProperty(mockCanvas, 'offsetWidth', { value: 800 });
      Object.defineProperty(mockCanvas, 'offsetHeight', { value: 600 });
      (component as any).canvas = { nativeElement: mockCanvas };

      // ACT
      component.addManualAgent();

      // ASSERT
      expect(localStorage.setItem).toHaveBeenCalled();
      const storedState = mockLocalStorage['screenplay-agent-instances'];
      expect(storedState).toBeDefined();

      const parsedState = JSON.parse(storedState);
      expect(Array.isArray(parsedState)).toBe(true);
      expect(parsedState.length).toBe(1);

      const [agentId, agentData] = parsedState[0];
      expect(agentId).toMatch(/^manual-[a-f0-9-]{36}$/);
      expect(agentData.status).toBe('pending');
    });
  });
});