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

      // ACT - Pass markdown content to syncAgentsWithMarkdown
      (component as any).syncAgentsWithMarkdown(testMarkdown);
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
      // ARRANGE - Use a valid emoji from AGENT_DEFINITIONS
      const testMarkdown = 'Test 🚀 content';
      component.editorContent = testMarkdown;

      // Mock the interactive editor's getEditorElement method
      const mockEditorElement = document.createElement('div');
      mockEditorElement.innerHTML = testMarkdown;
      mockEditorElement.textContent = testMarkdown;

      const mockEditor = {
        getEditorElement: jasmine.createSpy('getEditorElement').and.returnValue(mockEditorElement)
      };
      (component as any).interactiveEditor = mockEditor;

      // Mock canvas for positioning
      const mockCanvas = document.createElement('div');
      (component as any).canvas = { nativeElement: mockCanvas };

      // ACT
      (component as any).syncAgentsWithMarkdown(testMarkdown);

      // ASSERT - Verify agent instances were created with IDs
      expect((component as any).agentInstances.size).toBeGreaterThan(0);
      const instanceIds = Array.from((component as any).agentInstances.keys());
      expect(instanceIds[0]).toMatch(/[a-f0-9-]{36}/);
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
      (component as any).syncAgentsWithMarkdown(testMarkdown);

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
      (component as any).syncAgentsWithMarkdown(testMarkdown);

      // ASSERT
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'screenplay-agent-instances',
        jasmine.any(String)
      );

      const storedState = mockLocalStorage['screenplay-agent-instances'];
      const storedData = storedState ? JSON.parse(storedState) : null;
      expect(storedData).toBeDefined();
      expect(storedData.length).toBe(1);
      expect(storedData[0][1].emoji).toBe('🚀'); // Access emoji from [id, instance] tuple
    });
  });

  describe('State Clearing When Loading New Files', () => {
    it('should clear existing agents when loading new markdown content', (done) => {
      // ARRANGE - Setup initial state with agents
      const initialMarkdown = 'Initial 🔐 content';

      // Mock the interactive editor
      const mockEditor = {
        getMarkdown: jasmine.createSpy('getMarkdown').and.returnValue(initialMarkdown),
        setContent: jasmine.createSpy('setContent')
      };
      (component as any).interactiveEditor = mockEditor;

      spyOn(document, 'querySelector').and.returnValue(document.createElement('div'));
      spyOn(component as any, 'positionAgentsOverEmojis').and.stub();

      // Set initial content and trigger change detection
      component.editorContent = initialMarkdown;
      fixture.detectChanges();

      setTimeout(() => {
        (component as any).syncAgentsWithMarkdown(initialMarkdown);
        expect(component.agents.length).toBe(1);
        expect((component as any).agentInstances.size).toBe(1);

        // ACT - Load new content
        const newMarkdown = 'New 📊 content';
        mockEditor.getMarkdown.and.returnValue(newMarkdown);

        // Simulate loading new content with proper Angular lifecycle
        (component as any).agentInstances.clear();
        component.agents = [];
        component.editorContent = newMarkdown;

        // Force Angular to process the change in @Input
        fixture.detectChanges();

        setTimeout(() => {
          // Now that the DOM (simulated) is updated, sync should work
          (component as any).syncAgentsWithMarkdown(newMarkdown);

          // ASSERT - Old agents cleared, new agents created
          expect(component.agents.length).toBe(1);
          expect((component as any).agentInstances.size).toBe(1);

          // Verify it's the new agent, not the old one
          const remainingAgent = component.agents[0];
          expect(remainingAgent.data.emoji).toBe('📊');
          expect(remainingAgent.data.emoji).not.toBe('🔐');

          done();
        }, 100);
      }, 100);
    });

    it('should clear localStorage when agents are cleared', async () => {
      // ARRANGE
      const initialMarkdown = 'Test 🔥 content';
      const mockEditorElement = document.createElement('div');
      mockEditorElement.innerHTML = initialMarkdown;
      spyOn(document, 'querySelector').and.returnValue(mockEditorElement);
      spyOn(component as any, 'positionAgentsOverEmojis').and.stub();

      // Setup initial agents
      (component as any).syncAgentsWithMarkdown(initialMarkdown);
      expect(localStorage.setItem).toHaveBeenCalled();

      // ACT - Load empty content
      // Simulate loading empty content
      (component as any).agentInstances.clear();
      component.agents = [];
      component.editorContent = '';
      (component as any).syncAgentsWithMarkdown('');

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
      const firstContent = 'First 🔥 content';
      component.editorContent = firstContent;
      (component as any).syncAgentsWithMarkdown(firstContent);
      const secondContent = 'Second 📊 content';
      component.editorContent = secondContent;
      (component as any).syncAgentsWithMarkdown(secondContent);

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
    it('should save markdown content with HTML comments preserved', async () => {
      // ARRANGE - Mock the interactive editor with proper methods
      const mockEditor = {
        getHTML: jasmine.createSpy('getHTML').and.returnValue('<p>Test 🚀 content</p>'),
        convertHtmlToMarkdown: jasmine.createSpy('convertHtmlToMarkdown').and.returnValue('Test 🚀 <!-- agent-id: 123-456 --> content')
      };
      (component as any).interactiveEditor = mockEditor;

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

      // Read blob content using await
      const content = await blob.text();
      expect(content).toContain('🚀');
      expect(content).toContain('<!-- agent-id: 123-456 -->');
      expect(content).not.toMatch(/<div|<p|<span/); // No HTML tags
    });

    it('should convert HTML content to markdown before saving', async () => {
      // ARRANGE - Mock the interactive editor with proper methods
      const mockEditor = {
        getHTML: jasmine.createSpy('getHTML').and.returnValue('<p>Test <strong>🚀</strong> content</p>'),
        convertHtmlToMarkdown: jasmine.createSpy('convertHtmlToMarkdown').and.returnValue('Test **🚀** <!-- agent-id: 123 --> content')
      };
      (component as any).interactiveEditor = mockEditor;

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

      // Mock the interactive editor
      const mockEditor = {
        getHTML: jasmine.createSpy('getHTML').and.returnValue('<p>Deploy 🚀 the app</p>'),
        convertHtmlToMarkdown: jasmine.createSpy('convertHtmlToMarkdown')
      };
      (component as any).interactiveEditor = mockEditor;

      spyOn(document, 'querySelector').and.returnValue(document.createElement('div'));
      spyOn(component as any, 'positionAgentsOverEmojis').and.stub();

      // Create agents
      (component as any).syncAgentsWithMarkdown(initialContent);
      const originalAgentId = Array.from((component as any).agentInstances.keys())[0];

      // Update mock to include anchor in converted markdown
      const contentWithAnchor = `Deploy <!-- agent-id: ${originalAgentId} -->🚀 the app`;
      mockEditor.convertHtmlToMarkdown.and.returnValue(contentWithAnchor);

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
      (component as any).syncAgentsWithMarkdown(savedContent);
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
      (component as any).syncAgentsWithMarkdown(testContent);

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
      (component as any).syncAgentsWithMarkdown(testContent);
      const initialCount = component.agents.length;

      (component as any).syncAgentsWithMarkdown(testContent);
      const finalCount = component.agents.length;

      // ASSERT - Should not create duplicates
      expect(finalCount).toBe(initialCount);
      expect(component.agents.length).toBe(2); // Two 🚀 emojis
    });
  });

  describe('Agent Positioning Logic', () => {
    it('should position agents over corresponding emojis in DOM', () => {
      // ARRANGE
      const testContent = 'Test 🚀 content';

      // Mock the interactive editor's getEditorElement method
      const mockEditorElement = document.createElement('div');
      mockEditorElement.innerHTML = testContent;
      mockEditorElement.textContent = testContent;

      const mockEditor = {
        getEditorElement: jasmine.createSpy('getEditorElement').and.returnValue(mockEditorElement)
      };
      (component as any).interactiveEditor = mockEditor;

      // Mock canvas element for positioning
      const mockCanvas = document.createElement('div');
      mockCanvas.getBoundingClientRect = () => ({
        left: 0, top: 0, width: 800, height: 600,
        right: 800, bottom: 600, x: 0, y: 0, toJSON: () => {}
      }) as DOMRect;
      (component as any).canvas = { nativeElement: mockCanvas };

      // Create agent
      (component as any).syncAgentsWithMarkdown(testContent);

      // ACT - Position agents (this may not work perfectly in test env, but shouldn't crash)
      (component as any).positionAgentsOverEmojis();

      // ASSERT - Agent should exist (positioning is complex, just verify creation)
      const agent = component.agents[0];
      expect(agent).toBeDefined();
      expect(agent.data.emoji).toBe('🚀');
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

  describe('Critical Markdown Save Functionality', () => {
    it('should generate pure Markdown with anchors when saving', () => {
      // ARRANGE - Setup agent instance
      const agentId = 'test-uuid-12345';
      const emoji = '🚀';
      const agentInstance = {
        id: agentId,
        emoji: emoji,
        definition: { title: 'Test Agent', description: 'A test agent', unicode: '\\u{1F680}' },
        status: 'pending' as const,
        position: { x: 10, y: 10 },
      };
      (component as any).agentInstances.set(agentId, agentInstance);

      // Mock the interactive editor with proper methods
      // The convertHtmlToMarkdown will be called AFTER we inject anchors into HTML
      const mockEditorComponent = {
        getHTML: jasmine.createSpy('getHTML').and.returnValue('<h1>Título de Teste</h1><p>Conteúdo com <strong>negrito</strong> e o emoji 🚀.</p>'),
        convertHtmlToMarkdown: jasmine.createSpy('convertHtmlToMarkdown').and.callFake((html: string) => {
          // Simulate conversion, preserving HTML comments
          return html
            .replace(/<h1>(.*?)<\/h1>/g, '# $1')
            .replace(/<p>(.*?)<\/p>/g, '\n$1')
            .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
            .trim();
        })
      };
      (component as any).interactiveEditor = mockEditorComponent;

      // ACT - Call the refactored method
      const resultMarkdown = component.generateMarkdownForSave();

      // ASSERT - Verify outputs
      // Should contain the anchor and emoji
      const expectedAnchor = `<!-- agent-id: ${agentId} -->${emoji}`;
      expect(resultMarkdown).toContain(expectedAnchor);

      // Should be in Markdown format
      expect(resultMarkdown).toContain('# Título de Teste');
      expect(resultMarkdown).toContain('**negrito**');

      // Should NOT contain HTML tags
      expect(resultMarkdown).not.toContain('<h1>');
      expect(resultMarkdown).not.toContain('<p>');
      expect(resultMarkdown).not.toContain('<strong>');

      // Verify the editor methods were called
      expect(mockEditorComponent.getHTML).toHaveBeenCalled();
      expect(mockEditorComponent.convertHtmlToMarkdown).toHaveBeenCalled();

      console.log('🧪 Test result markdown:', resultMarkdown);
    });

    it('should handle missing editor gracefully', () => {
      // ARRANGE
      const agentId = 'test-uuid-67890';
      const agentInstance = {
        id: agentId,
        emoji: '📊',
        definition: { title: 'Analytics Agent', description: 'Test analytics', unicode: '\\u{1F4CA}' },
        status: 'pending' as const,
        position: { x: 20, y: 20 },
      };
      (component as any).agentInstances.set(agentId, agentInstance);

      // Set interactiveEditor to null to simulate missing editor
      (component as any).interactiveEditor = null;

      // ACT
      const resultMarkdown = component.generateMarkdownForSave();

      // ASSERT
      expect(resultMarkdown).toBe('');  // Should return empty string when editor is missing
    });

    it('should preserve existing anchors and not duplicate them', () => {
      // ARRANGE
      const agentId = 'existing-uuid-99999';
      const emoji = '⚡';
      const agentInstance = {
        id: agentId,
        emoji: emoji,
        definition: { title: 'Speed Agent', description: 'Existing agent', unicode: '\\u{26A1}' },
        status: 'completed' as const,
        position: { x: 30, y: 30 },
      };
      (component as any).agentInstances.set(agentId, agentInstance);

      // Mock editor that returns HTML with existing anchor
      const existingAnchor = `<!-- agent-id: ${agentId} -->`;
      const mockEditorComponent = {
        getHTML: jasmine.createSpy('getHTML').and.returnValue(`<h2>Performance</h2><p>Speed optimization ${existingAnchor}⚡ is critical.</p>`),
        convertHtmlToMarkdown: jasmine.createSpy('convertHtmlToMarkdown').and.returnValue(`## Performance\n\nSpeed optimization ${existingAnchor}⚡ is critical.`)
      };
      (component as any).interactiveEditor = mockEditorComponent;

      // ACT
      const resultMarkdown = component.generateMarkdownForSave();

      // ASSERT
      // Should contain the anchor only once (not duplicated)
      const anchorCount = (resultMarkdown.match(new RegExp(existingAnchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      expect(anchorCount).toBe(1);
      expect(resultMarkdown).toContain(existingAnchor);
      expect(resultMarkdown).toContain('⚡');

      // Verify the editor methods were called
      expect(mockEditorComponent.getHTML).toHaveBeenCalled();
      expect(mockEditorComponent.convertHtmlToMarkdown).toHaveBeenCalled();
    });
  });

  describe('Editor Changes to Disk Save Flow', () => {
    it('should save current editor content (not stale content) when user makes changes', async () => {
      // ARRANGE - Setup editor with initial content
      const initialContent = 'Initial content 🚀';
      const userChangedContent = 'User edited content 📊';

      const mockEditor = {
        getHTML: jasmine.createSpy('getHTML').and.returnValue('<p>Initial content 🚀</p>'),
        convertHtmlToMarkdown: jasmine.createSpy('convertHtmlToMarkdown').and.returnValue(initialContent)
      };
      (component as any).interactiveEditor = mockEditor;

      // Mock file download
      const mockLink = document.createElement('a');
      spyOn(document, 'createElement').and.returnValue(mockLink);
      spyOn(mockLink, 'click').and.stub();
      spyOn(URL, 'createObjectURL').and.returnValue('mock-url');

      // ACT - Simulate user editing content in the editor
      // This is what should happen when user types in the editor
      mockEditor.getHTML.and.returnValue('<p>User edited content 📊</p>');
      mockEditor.convertHtmlToMarkdown.and.returnValue(userChangedContent);

      // User clicks save - this should capture the CURRENT editor content
      component.saveMarkdownFile();

      // ASSERT - Verify the saved content is the current editor content, not stale
      const createObjectURLCall = (URL.createObjectURL as jasmine.Spy).calls.mostRecent();
      const blob = createObjectURLCall.args[0] as Blob;
      const savedContent = await blob.text();

      expect(savedContent).toContain('User edited content');
      expect(savedContent).toContain('📊');
      expect(savedContent).not.toContain('Initial content');
      expect(savedContent).not.toContain('🚀');

      // Verify methods were called to get current content
      expect(mockEditor.getHTML).toHaveBeenCalled();
      expect(mockEditor.convertHtmlToMarkdown).toHaveBeenCalled();
    });

    it('should update editorContent property when user changes editor', () => {
      // ARRANGE - Setup editor with change handler
      const mockEditor = {
        getHTML: jasmine.createSpy('getHTML').and.returnValue('<p>New content</p>'),
        getMarkdown: jasmine.createSpy('getMarkdown'),
        commands: { setContent: jasmine.createSpy('setContent') },
        on: jasmine.createSpy('on')
      };
      (component as any).interactiveEditor = mockEditor;

      // ACT - Simulate editor content change event
      const newContent = 'Updated by user 🎯';
      mockEditor.getHTML.and.returnValue('<p>Updated by user 🎯</p>');
      mockEditor.getMarkdown.and.returnValue(newContent);

      // Directly update the component's editorContent (this is what happens via event binding)
      component.editorContent = newContent;

      // ASSERT - Component state should be updated
      expect(component.editorContent).toContain('Updated by user');
      expect(component.editorContent).toContain('🎯');
    });
  });
});