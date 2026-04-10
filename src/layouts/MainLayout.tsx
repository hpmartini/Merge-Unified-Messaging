import React from 'react';
import Sidebar from '../components/Sidebar';
import { ChatArea } from '../components/ChatArea';
import MediaGallery from '../../components/MediaGallery';
import Lightbox from '../../components/Lightbox';
import PDFViewer from '../../components/PDFViewer';
import SettingsModal from '../../components/SettingsModal';
import { useAppStore } from '../store/useAppStore';
import { Message, Attachment } from '../../types';

export interface MainLayoutProps {
  whatsapp: any;
  signal: any;
  telegram: any;
  email: any;
  slack: any;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ whatsapp, signal, telegram, email, slack }) => {
  const { showMobileChat, isGalleryOpen, setIsGalleryOpen, messages, selectedUser, lightboxImage, setLightboxImage, activePDF, setActivePDF, isSettingsOpen, setIsSettingsOpen, theme, setTheme } = useAppStore();

  const handleDocumentAction = (att: Attachment) => {
    if (att.name.toLowerCase().endsWith('.pdf')) {
      setActivePDF(att);
    } else {
      const link = document.createElement('a');
      link.href = att.url;
      link.download = att.name;
      link.click();
    }
  };

  return (
    <div className="flex h-screen bg-theme-base text-theme-main overflow-hidden font-sans selection:bg-blue-500/30">
      <div className={`${showMobileChat ? 'hidden' : 'flex'} w-full md:w-auto md:flex h-full`}>
        <Sidebar />
      </div>

      <div className={`${showMobileChat ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0 relative bg-theme-base`}>
        <ChatArea whatsapp={whatsapp} signal={signal} telegram={telegram} email={email} slack={slack} />
      </div>

      <MediaGallery 
        isOpen={isGalleryOpen} 
        onClose={() => setIsGalleryOpen(false)} 
        messages={messages.filter((m: Message) => selectedUser && new Set([selectedUser.id, ...(selectedUser.alternateIds || [])]).has(m.userId))} 
        onImageClick={setLightboxImage}
        onDocView={handleDocumentAction}
      />

      <Lightbox 
        attachment={lightboxImage} 
        onClose={() => setLightboxImage(null)} 
      />

      <PDFViewer 
        attachment={activePDF} 
        onClose={() => setActivePDF(null)} 
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentTheme={theme}
        onSetTheme={setTheme}
        whatsapp={whatsapp}
        signal={signal}
      />
    </div>
  );
};
