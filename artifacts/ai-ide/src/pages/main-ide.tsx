import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Sidebar } from '@/components/layout/sidebar';
import { CodeEditor } from '@/components/editor/monaco-editor';
import { ChatPanel } from '@/components/chat/chat-panel';

export default function MainIde() {
  return (
    <div className="h-screen w-full bg-background flex overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex overflow-hidden">
        <PanelGroup direction="horizontal">
          <Panel defaultSize={60} minSize={30}>
            <CodeEditor />
          </Panel>
          
          <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 active:bg-primary transition-colors cursor-col-resize z-10" />
          
          <Panel defaultSize={40} minSize={25}>
            <ChatPanel />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
