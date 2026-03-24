
import React, { useState, useEffect } from 'react';
import { X, Moon, Sun, Smartphone, Plus, Check, Mail, ArrowLeft, Loader2, Lock, Shield, QrCode, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Platform } from '../types';
import { PLATFORM_CONFIG } from '../constants';

// Platforms that use QR code pairing instead of credentials
const QR_CODE_PLATFORMS = [Platform.WhatsApp, Platform.WhatsAppBusiness, Platform.Signal];

// Type for the whatsapp hook return
interface WhatsAppHook {
  status: 'disconnected' | 'connecting' | 'qr' | 'authenticated' | 'ready' | 'error';
  qrCode: string | null;
  user: { id: string; name: string; phone: string } | null;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
}

// Type for the signal hook return
interface SignalHook {
  status: 'disconnected' | 'connecting' | 'need_setup' | 'linking' | 'verification_needed' | 'ready' | 'error';
  linkUri: string | null;
  user: { id: string; name: string; phone: string } | null;
  chats: { id: string; name: string }[];
  error: string | null;
  connect: (phoneNumber?: string) => void;
  disconnect: () => void;
  startLink: () => void;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: string;
  onSetTheme: (theme: 'dark' | 'dimmed' | 'light') => void;
  whatsapp: WhatsAppHook;
  signal: SignalHook;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentTheme,
  onSetTheme,
  whatsapp,
  signal
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'accounts'>('general');
  const [connectedAccounts, setConnectedAccounts] = useState<Record<string, boolean>>({
    [Platform.Mail]: false,
    [Platform.WhatsApp]: whatsapp.status === 'ready',
    [Platform.Signal]: signal.status === 'ready' || signal.chats.length > 0,
  });

  // Add Account Flow State
  const [addAccountStep, setAddAccountStep] = useState<'list' | 'select' | 'form' | 'qr'>('list');
  const [selectedPlatformToAdd, setSelectedPlatformToAdd] = useState<Platform | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [credentialValues, setCredentialValues] = useState({ identifier: '', secret: '' });

  // Sync WhatsApp connection status
  useEffect(() => {
    if (whatsapp.status === 'ready' && whatsapp.user) {
      setConnectedAccounts(prev => ({ ...prev, [Platform.WhatsApp]: true }));
      // Return to list after successful connection
      if (addAccountStep === 'qr' && selectedPlatformToAdd === Platform.WhatsApp) {
        setTimeout(() => {
          setAddAccountStep('list');
          setSelectedPlatformToAdd(null);
        }, 1500);
      }
    } else if (whatsapp.status === 'disconnected') {
      setConnectedAccounts(prev => ({ ...prev, [Platform.WhatsApp]: false }));
    }
  }, [whatsapp.status, whatsapp.user, addAccountStep, selectedPlatformToAdd]);

  // Sync Signal connection status — also consider cached chats as "connected"
  useEffect(() => {
    if ((signal.status === 'ready' && signal.user) || signal.chats.length > 0) {
      setConnectedAccounts(prev => ({ ...prev, [Platform.Signal]: true }));
      // Return to list after successful connection
      if (addAccountStep === 'qr' && selectedPlatformToAdd === Platform.Signal) {
        setTimeout(() => {
          setAddAccountStep('list');
          setSelectedPlatformToAdd(null);
        }, 1500);
      }
    } else if (signal.status === 'disconnected' && signal.chats.length === 0) {
      setConnectedAccounts(prev => ({ ...prev, [Platform.Signal]: false }));
    }
  }, [signal.status, signal.user, signal.chats.length, addAccountStep, selectedPlatformToAdd]);

  if (!isOpen) return null;

  // Group platforms for cleaner UI
  const platformGroups = [
    { name: 'Messaging', items: [Platform.WhatsApp, Platform.WhatsAppBusiness, Platform.Signal, Platform.Telegram, Platform.Facebook, Platform.Threema, Platform.SMS] },
    { name: 'Work', items: [Platform.Slack, Platform.Teams, Platform.Mail, Platform.LinkedIn] },
    { name: 'Social', items: [Platform.Twitter, Platform.Instagram] },
  ];

  const toggleAccount = (p: Platform) => {
    setConnectedAccounts(prev => ({
      ...prev,
      [p]: !prev[p]
    }));
  };

  const handleStartAddAccount = () => {
    setAddAccountStep('select');
  };

  const handleSelectPlatform = (p: Platform) => {
    setSelectedPlatformToAdd(p);
    if (QR_CODE_PLATFORMS.includes(p)) {
      setAddAccountStep('qr');
      // Start real WhatsApp connection
      if (p === Platform.WhatsApp || p === Platform.WhatsAppBusiness) {
        whatsapp.connect();
      }
      // Start Signal device linking
      if (p === Platform.Signal) {
        signal.connect();
        // Give it a moment to connect, then start linking
        setTimeout(() => signal.startLink(), 500);
      }
    } else {
      setAddAccountStep('form');
      setCredentialValues({ identifier: '', secret: '' });
    }
  };

  const handleBack = () => {
    if (addAccountStep === 'form' || addAccountStep === 'qr') {
      setAddAccountStep('select');
      setSelectedPlatformToAdd(null);
      // Disconnect WhatsApp if we're backing out
      if (whatsapp.status !== 'disconnected' && whatsapp.status !== 'ready') {
        whatsapp.disconnect();
      }
      // Disconnect Signal if we're backing out
      if (signal.status !== 'disconnected' && signal.status !== 'ready') {
        signal.disconnect();
      }
    } else if (addAccountStep === 'select') {
      setAddAccountStep('list');
    }
  };

  const handleConnect = () => {
    if (!selectedPlatformToAdd) return;
    setIsConnecting(true);
    
    // Simulate API call
    setTimeout(() => {
      setConnectedAccounts(prev => ({ ...prev, [selectedPlatformToAdd]: true }));
      setIsConnecting(false);
      setAddAccountStep('list');
      setSelectedPlatformToAdd(null);
    }, 1500);
  };

  const renderPlatformSelection = () => (
    <div className="space-y-6 animate-in slide-in-from-right duration-300">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={handleBack} className="p-1 hover:bg-theme-hover rounded-full text-theme-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
            <h3 className="text-lg font-bold text-theme-main">Select Service</h3>
            <p className="text-xs text-theme-muted">Choose a platform to connect</p>
        </div>
      </div>

      <div className="space-y-6">
        {platformGroups.map((group) => (
            <div key={group.name}>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-theme-muted mb-3">{group.name}</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {group.items.map(p => {
                        const config = PLATFORM_CONFIG[p as Platform];
                        const isConnected = connectedAccounts[p as string];
                        return (
                            <button
                                key={p}
                                onClick={() => !isConnected && handleSelectPlatform(p as Platform)}
                                disabled={isConnected}
                                className={`
                                    flex flex-col items-center justify-center gap-3 p-4 rounded-xl border transition-all
                                    ${isConnected 
                                        ? 'bg-theme-base/50 border-transparent opacity-50 cursor-not-allowed grayscale' 
                                        : 'bg-theme-base border-theme hover:border-blue-500 hover:bg-theme-hover cursor-pointer shadow-sm hover:shadow-md'
                                    }
                                `}
                            >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${config.bgColor} text-white shadow-lg`}>
                                    {p === Platform.Mail ? <Mail className="w-5 h-5" /> : <span className="font-bold text-xs">{p.toString().substring(0, 2)}</span>}
                                </div>
                                <span className="text-xs font-bold text-theme-main">{config.label}</span>
                                {isConnected && <span className="text-[9px] text-green-500 font-bold bg-green-500/10 px-2 py-0.5 rounded-full">CONNECTED</span>}
                            </button>
                        );
                    })}
                </div>
            </div>
        ))}
      </div>
    </div>
  );

  const renderQrCodeFlow = () => {
    if (!selectedPlatformToAdd) return null;
    const config = PLATFORM_CONFIG[selectedPlatformToAdd];
    const isWhatsApp = selectedPlatformToAdd === Platform.WhatsApp || selectedPlatformToAdd === Platform.WhatsAppBusiness;
    const isSignal = selectedPlatformToAdd === Platform.Signal;

    return (
      <div className="flex flex-col h-full animate-in slide-in-from-right duration-300">
        <div className="flex items-center gap-2 mb-6">
          <button onClick={handleBack} className="p-1 hover:bg-theme-hover rounded-full text-theme-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${config.bgColor} text-white`}>
              <span className="font-bold text-[9px]">{selectedPlatformToAdd.toString().substring(0, 2)}</span>
            </div>
            <h3 className="text-lg font-bold text-theme-main">Connect {config.label}</h3>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full">
          {/* QR Code Container */}
          <div className={`relative bg-white p-4 rounded-2xl shadow-2xl mb-6 transition-all`}>
            {/* Loading / Connecting state - WhatsApp */}
            {(whatsapp.status === 'connecting' || whatsapp.status === 'disconnected') && isWhatsApp && (
              <div className="w-48 h-48 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-12 h-12 text-gray-400 animate-spin" />
                <span className="text-sm text-gray-500">Starting WhatsApp...</span>
              </div>
            )}

            {/* QR Code from WhatsApp */}
            {whatsapp.status === 'qr' && whatsapp.qrCode && isWhatsApp && (
              <div className="w-64 h-64">
                <QRCodeSVG
                  value={whatsapp.qrCode}
                  size={256}
                  level="M"
                  marginSize={0}
                />
              </div>
            )}

            {/* Authenticated - waiting for ready - WhatsApp */}
            {whatsapp.status === 'authenticated' && isWhatsApp && (
              <div className="w-48 h-48 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-12 h-12 text-green-500 animate-spin" />
                <span className="text-sm font-bold text-green-600">Authenticating...</span>
              </div>
            )}

            {/* Connected - WhatsApp */}
            {whatsapp.status === 'ready' && isWhatsApp && (
              <div className="w-48 h-48 flex flex-col items-center justify-center gap-3">
                <CheckCircle2 className="w-16 h-16 text-green-500" />
                <span className="text-sm font-bold text-green-600">Connected!</span>
                {whatsapp.user && (
                  <span className="text-xs text-gray-500">{whatsapp.user.name}</span>
                )}
              </div>
            )}

            {/* Error state - WhatsApp */}
            {whatsapp.status === 'error' && isWhatsApp && (
              <div className="w-48 h-48 flex flex-col items-center justify-center gap-3">
                <AlertCircle className="w-12 h-12 text-red-500" />
                <span className="text-sm font-bold text-red-500">Connection Error</span>
                <span className="text-xs text-gray-500 text-center px-4">{whatsapp.error}</span>
              </div>
            )}

            {/* Signal States */}
            {/* Loading / Connecting state - Signal */}
            {(signal.status === 'connecting' || signal.status === 'need_setup') && isSignal && (
              <div className="w-48 h-48 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
                <span className="text-sm text-gray-500">Preparing Signal link...</span>
              </div>
            )}

            {/* QR Code from Signal */}
            {signal.status === 'linking' && signal.linkUri && isSignal && (
              <div className="w-64 h-64">
                <QRCodeSVG
                  value={signal.linkUri}
                  size={256}
                  level="M"
                  marginSize={0}
                />
              </div>
            )}

            {/* Linking without QR yet - Signal */}
            {signal.status === 'linking' && !signal.linkUri && isSignal && (
              <div className="w-48 h-48 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
                <span className="text-sm text-gray-500">Generating QR code...</span>
              </div>
            )}

            {/* Connected - Signal */}
            {signal.status === 'ready' && isSignal && (
              <div className="w-48 h-48 flex flex-col items-center justify-center gap-3">
                <CheckCircle2 className="w-16 h-16 text-blue-500" />
                <span className="text-sm font-bold text-blue-600">Connected!</span>
                {signal.user && (
                  <span className="text-xs text-gray-500">{signal.user.phone}</span>
                )}
              </div>
            )}

            {/* Error state - Signal */}
            {signal.status === 'error' && isSignal && (
              <div className="w-48 h-48 flex flex-col items-center justify-center gap-3">
                <AlertCircle className="w-12 h-12 text-red-500" />
                <span className="text-sm font-bold text-red-500">Connection Error</span>
                <span className="text-xs text-gray-500 text-center px-4">{signal.error}</span>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="text-center space-y-4">
            <h4 className="text-lg font-bold text-theme-main">
              {(whatsapp.status === 'ready' && isWhatsApp) || (signal.status === 'ready' && isSignal)
                ? 'Successfully Connected!'
                : `Scan with ${config.label}`}
            </h4>

            {/* WhatsApp QR instructions */}
            {whatsapp.status === 'qr' && isWhatsApp && (
              <ol className="text-sm text-theme-muted space-y-2 text-left">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-theme-hover flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                  <span>Open {config.label} on your phone</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-theme-hover flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                  <span>Go to Settings → Linked Devices</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-theme-hover flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                  <span>Tap "Link a Device" and scan this code</span>
                </li>
              </ol>
            )}

            {/* Signal QR instructions */}
            {signal.status === 'linking' && isSignal && (
              <ol className="text-sm text-theme-muted space-y-2 text-left">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-theme-hover flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                  <span>Open Signal on your phone</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-theme-hover flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                  <span>Go to Settings → Linked Devices</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-theme-hover flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                  <span>Tap "+" or "Link New Device" and scan this code</span>
                </li>
              </ol>
            )}

            {whatsapp.status === 'error' && isWhatsApp && (
              <button
                onClick={() => whatsapp.connect()}
                className="flex items-center gap-2 mx-auto bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
            )}

            {signal.status === 'error' && isSignal && (
              <button
                onClick={() => {
                  signal.connect();
                  setTimeout(() => signal.startLink(), 500);
                }}
                className="flex items-center gap-2 mx-auto bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
            )}

            {/* Server hint - WhatsApp */}
            {(whatsapp.status === 'error' || whatsapp.status === 'connecting') && isWhatsApp && (
              <p className="text-xs text-theme-muted opacity-75 mt-4 max-w-xs">
                Make sure the WhatsApp server is running:<br />
                <code className="bg-theme-base px-2 py-1 rounded text-[10px] block mt-1">
                  node server/whatsapp-server.js
                </code>
              </p>
            )}

            {/* Server hint - Signal */}
            {(signal.status === 'error' || signal.status === 'connecting') && isSignal && (
              <p className="text-xs text-theme-muted opacity-75 mt-4 max-w-xs">
                Make sure the Signal server is running:<br />
                <code className="bg-theme-base px-2 py-1 rounded text-[10px] block mt-1">
                  node server/signal-server.js
                </code>
              </p>
            )}
          </div>

          {/* Security note */}
          <div className="mt-6 p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-start gap-3 max-w-sm">
            <Shield className="w-5 h-5 text-green-400 flex-shrink-0" />
            <p className="text-xs text-green-300/90 leading-relaxed">
              Your messages stay end-to-end encrypted. Merge syncs via {isSignal ? 'Signal protocol' : 'WhatsApp Web protocol'}.
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderAccountForm = () => {
      if (!selectedPlatformToAdd) return null;
      const config = PLATFORM_CONFIG[selectedPlatformToAdd];

      return (
        <div className="flex flex-col h-full animate-in slide-in-from-right duration-300">
             <div className="flex items-center gap-2 mb-6">
                <button onClick={handleBack} className="p-1 hover:bg-theme-hover rounded-full text-theme-muted transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${config.bgColor} text-white`}>
                         <span className="font-bold text-[9px]">{selectedPlatformToAdd.toString().substring(0, 2)}</span>
                    </div>
                    <h3 className="text-lg font-bold text-theme-main">Connect {config.label}</h3>
                </div>
            </div>

            <div className="flex-1 max-w-sm mx-auto w-full space-y-4">
                <div className="bg-theme-base border border-theme rounded-xl p-6 shadow-lg">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-theme-muted uppercase tracking-wider mb-1.5">Email / Phone</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-theme-muted" />
                                <input 
                                    type="text" 
                                    className="w-full bg-theme-panel border border-theme rounded-lg py-2 pl-9 pr-3 text-sm text-theme-main focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    placeholder="user@example.com"
                                    value={credentialValues.identifier}
                                    onChange={e => setCredentialValues({...credentialValues, identifier: e.target.value})}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-theme-muted uppercase tracking-wider mb-1.5">Password / API Key</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-theme-muted" />
                                <input 
                                    type="password" 
                                    className="w-full bg-theme-panel border border-theme rounded-lg py-2 pl-9 pr-3 text-sm text-theme-main focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    placeholder="••••••••••••"
                                    value={credentialValues.secret}
                                    onChange={e => setCredentialValues({...credentialValues, secret: e.target.value})}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-3">
                        <Shield className="w-5 h-5 text-blue-400 flex-shrink-0" />
                        <p className="text-xs text-blue-300/90 leading-relaxed">
                            Your credentials are encrypted locally and never shared with third parties. We use OAuth 2.0 whenever supported.
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleConnect}
                    disabled={!credentialValues.identifier || !credentialValues.secret || isConnecting}
                    className={`
                        w-full py-3 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all
                        ${!credentialValues.identifier || !credentialValues.secret || isConnecting
                            ? 'bg-theme-hover text-theme-muted cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40 hover:scale-[1.02]'
                        }
                    `}
                >
                    {isConnecting ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Connecting...
                        </>
                    ) : (
                        'Link Account'
                    )}
                </button>
            </div>
        </div>
      );
  }

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-theme-panel w-full max-w-2xl h-[80vh] rounded-2xl border border-theme shadow-2xl overflow-hidden flex flex-col animate-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="h-14 border-b border-theme flex items-center justify-between px-6 flex-shrink-0">
          <h2 className="text-lg font-bold text-theme-main">Settings</h2>
          <button onClick={onClose} className="text-theme-muted hover:text-theme-main p-1 rounded-md hover:bg-theme-hover transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Tabs - Only show if not in specific add account sub-step to avoid clutter */}
          {addAccountStep === 'list' && (
            <div className="w-48 bg-theme-base border-r border-theme flex flex-col p-2 space-y-1">
                <button
                onClick={() => setActiveTab('general')}
                className={`text-left px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'general' ? 'bg-blue-600 text-white' : 'text-theme-muted hover:bg-theme-hover hover:text-theme-main'}`}
                >
                General & Theme
                </button>
                <button
                onClick={() => setActiveTab('accounts')}
                className={`text-left px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'accounts' ? 'bg-blue-600 text-white' : 'text-theme-muted hover:bg-theme-hover hover:text-theme-main'}`}
                >
                Accounts
                </button>
            </div>
          )}

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6 bg-theme-panel">
            
            {activeTab === 'general' && addAccountStep === 'list' && (
              <div className="space-y-8 animate-in fade-in duration-200">
                <section>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-theme-muted mb-4">Appearance</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {/* Dark Theme Option */}
                    <button
                      onClick={() => onSetTheme('dark')}
                      className={`relative group rounded-xl border-2 p-4 transition-all ${currentTheme === 'dark' ? 'border-blue-500 bg-slate-900' : 'border-theme bg-slate-900/50 hover:border-slate-600'}`}
                    >
                      <div className="h-20 bg-slate-950 rounded-lg mb-3 border border-slate-800 flex flex-col p-2 gap-2 overflow-hidden">
                         <div className="w-3/4 h-2 bg-slate-800 rounded"></div>
                         <div className="w-1/2 h-2 bg-slate-800 rounded"></div>
                         <div className="mt-auto self-end w-8 h-8 rounded-full bg-blue-600"></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Moon className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-bold text-slate-200">Dark</span>
                      </div>
                      {currentTheme === 'dark' && <div className="absolute top-2 right-2 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>}
                    </button>

                    {/* Dimmed Theme Option */}
                    <button
                      onClick={() => onSetTheme('dimmed')}
                      className={`relative group rounded-xl border-2 p-4 transition-all ${currentTheme === 'dimmed' ? 'border-blue-500 bg-zinc-700' : 'border-theme bg-zinc-700/50 hover:border-zinc-500'}`}
                    >
                      <div className="h-20 bg-zinc-800 rounded-lg mb-3 border border-zinc-600 flex flex-col p-2 gap-2 overflow-hidden">
                         <div className="w-3/4 h-2 bg-zinc-600 rounded"></div>
                         <div className="w-1/2 h-2 bg-zinc-600 rounded"></div>
                         <div className="mt-auto self-end w-8 h-8 rounded-full bg-blue-600"></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-zinc-300" />
                        <span className="text-sm font-bold text-zinc-100">Dimmed</span>
                      </div>
                      {currentTheme === 'dimmed' && <div className="absolute top-2 right-2 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>}
                    </button>

                    {/* Light Theme Option */}
                    <button
                      onClick={() => onSetTheme('light')}
                      className={`relative group rounded-xl border-2 p-4 transition-all ${currentTheme === 'light' ? 'border-blue-500 bg-slate-50' : 'border-theme bg-white hover:border-slate-300'}`}
                    >
                      <div className="h-20 bg-white rounded-lg mb-3 border border-slate-200 flex flex-col p-2 gap-2 overflow-hidden shadow-inner">
                         <div className="w-3/4 h-2 bg-slate-200 rounded"></div>
                         <div className="w-1/2 h-2 bg-slate-200 rounded"></div>
                         <div className="mt-auto self-end w-8 h-8 rounded-full bg-blue-500"></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Sun className="w-4 h-4 text-slate-600" />
                        <span className="text-sm font-bold text-slate-900">Light</span>
                      </div>
                      {currentTheme === 'light' && <div className="absolute top-2 right-2 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>}
                    </button>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'accounts' && (
              <>
                {addAccountStep === 'list' && (
                    <div className="space-y-8 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-theme-main">Connected Accounts</h3>
                            <p className="text-sm text-theme-muted">Manage your messaging and email integrations</p>
                        </div>
                        <button 
                            onClick={handleStartAddAccount}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-blue-900/20"
                        >
                            <Plus className="w-4 h-4" />
                            Add Account
                        </button>
                        </div>

                        {platformGroups.map((group) => (
                        <div key={group.name} className="space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-theme-muted border-b border-theme pb-1">{group.name}</h4>
                            <div className="grid grid-cols-1 gap-2">
                            {group.items.map(p => {
                                const config = PLATFORM_CONFIG[p as Platform];
                                // Check actual hook status for WhatsApp and Signal
                                const isConnected = p === Platform.WhatsApp ? whatsapp.status === 'ready'
                                  : p === Platform.Signal ? signal.status === 'ready'
                                  : connectedAccounts[p as string];
                                return (
                                <div key={p} className="flex items-center justify-between p-3 rounded-lg bg-theme-base border border-theme hover:border-slate-500/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${config.bgColor} text-white shadow-lg`}>
                                        {p === Platform.Mail ? <Mail className="w-5 h-5" /> : <span className="font-bold text-xs">{p.toString().substring(0, 2)}</span>}
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-theme-main">{config.label}</div>
                                        <div className="text-xs text-theme-muted">{isConnected ? 'Syncing • Last check 2m ago' : 'Not connected'}</div>
                                    </div>
                                    </div>
                                    <button
                                    onClick={() => toggleAccount(p as Platform)}
                                    className={`w-12 h-6 rounded-full transition-colors relative ${isConnected ? 'bg-blue-600' : 'bg-slate-700'}`}
                                    >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${isConnected ? 'left-7' : 'left-1'}`} />
                                    </button>
                                </div>
                                );
                            })}
                            </div>
                        </div>
                        ))}
                    </div>
                )}
                
                {/* Add Account Flows */}
                {addAccountStep === 'select' && renderPlatformSelection()}
                {addAccountStep === 'qr' && renderQrCodeFlow()}
                {addAccountStep === 'form' && renderAccountForm()}
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
