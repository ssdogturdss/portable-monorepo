import React, { createContext, useContext, useState } from 'react';

interface IdeState {
  activeSessionId: number | null;
  setActiveSessionId: (id: number | null) => void;
  editorContent: string;
  setEditorContent: (content: string) => void;
  editorLanguage: string;
  setEditorLanguage: (language: string) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
}

const IdeContext = createContext<IdeState | null>(null);

export function IdeProvider({ children }: { children: React.ReactNode }) {
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [editorContent, setEditorContent] = useState<string>('// Start coding...');
  const [editorLanguage, setEditorLanguage] = useState<string>('javascript');
  const [selectedModel, setSelectedModel] = useState<string>('grok-beta');

  return (
    <IdeContext.Provider
      value={{
        activeSessionId,
        setActiveSessionId,
        editorContent,
        setEditorContent,
        editorLanguage,
        setEditorLanguage,
        selectedModel,
        setSelectedModel,
      }}
    >
      {children}
    </IdeContext.Provider>
  );
}

export function useIde() {
  const context = useContext(IdeContext);
  if (!context) {
    throw new Error('useIde must be used within an IdeProvider');
  }
  return context;
}
