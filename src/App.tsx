/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { 
  Layers, 
  Settings2, 
  Download, 
  Trash2, 
  Plus, 
  ExternalLink, 
  Copy, 
  Check,
  GripVertical,
  Image as ImageIcon
} from 'lucide-react';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragEndEvent 
} from '@dnd-kit/core';
import { 
  SortableContext, 
  arrayMove, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy, 
  useSortable 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PreviewItem {
  id: string;
  url: string;
  title: string;
  description: string;
  image: string;
  favicon: string;
}

const SortableItem = ({ item, onRemove }: { item: PreviewItem, onRemove: (id: string) => void }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { zIndex: 50 } : {})
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={`preview-card group relative bg-slate-900/40 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md hover:border-cyan-500/30 transition-shadow ${
        isDragging ? 'shadow-2xl shadow-cyan-500/20 border-cyan-500/50' : ''
      }`}
    >
      <div className="aspect-video w-full relative overflow-hidden">
        <img src={item.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />
        
        {/* Metadata Overlay */}
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
          <div className="flex items-center gap-3">
            <img src={item.favicon} alt="" className="w-8 h-8 rounded-lg bg-white/10 p-1 backdrop-blur-md" />
            <div>
              <h3 className="text-sm font-bold text-white truncate max-w-[150px] sm:max-w-xs">{item.title}</h3>
              <p className="text-[10px] text-slate-400 truncate max-w-[150px] sm:max-w-xs">{item.url}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="p-2 bg-white/10 backdrop-blur-md rounded-lg hover:bg-white/20 transition-colors cursor-pointer">
              <ExternalLink size={14} />
            </button>
            <button 
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onRemove(item.id);
              }}
              className="p-2 bg-red-500/10 backdrop-blur-md rounded-lg hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
      
      {/* Drag Handle */}
      <div 
        {...attributes} 
        {...listeners}
        className="absolute top-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <div className="bg-slate-950/50 p-1.5 rounded-md backdrop-blur-md border border-white/10">
          <GripVertical size={16} className="text-slate-400" />
        </div>
      </div>
    </div>
  );
};

// --- Real-time API for Link Metadata ---
const fetchMetadata = async (url: string) => {
  const cleanUrl = url.startsWith('http') ? url : `https://${url}`;
  try {
    const response = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(cleanUrl)}&screenshot=true&meta=true`);
    const data = await response.json();
    
    if (data.status === 'success') {
      return {
        id: Math.random().toString(36).substring(2, 9),
        url: cleanUrl,
        title: data.data.title || cleanUrl.split('//')[1]?.split('/')[0] || "Untitled Link",
        description: data.data.description || "Premium link preview generated with high-fidelity metadata extraction.",
        image: data.data.image?.url || data.data.screenshot?.url || `https://s.wordpress.com/mshots/v1/${encodeURIComponent(cleanUrl)}?w=800`,
        favicon: data.data.logo?.url || `https://www.google.com/s2/favicons?domain=${cleanUrl}&sz=64`
      };
    }
  } catch (error) {
    console.error("Error fetching metadata:", error instanceof Error ? error.message : String(error));
  }
  
  return {
    id: Math.random().toString(36).substring(2, 9),
    url: cleanUrl,
    title: cleanUrl.split('//')[1]?.split('/')[0] || "Untitled Link",
    description: "Real-time preview generated via backup extraction engine.",
    image: `https://s.wordpress.com/mshots/v1/${encodeURIComponent(cleanUrl)}?w=800`,
    favicon: `https://www.google.com/s2/favicons?domain=${cleanUrl}&sz=64`
  };
};

export default function App() {
  const [urls, setUrls] = useState("");
  const [previews, setPreviews] = useState<{
    id: string;
    url: string;
    title: string;
    description: string;
    image: string;
    favicon: string;
  }[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('lnk_prv_settings');
    return saved ? JSON.parse(saved) : {
      quality: 80,
      size: 'medium',
      format: 'markdown',
      showMetadata: true
    };
  });
  const [copied, setCopied] = useState(false);

  const galleryRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // --- Persistence ---
  useEffect(() => {
    localStorage.setItem('lnk_prv_settings', JSON.stringify(settings));
  }, [settings]);

  // --- Animations ---
  useEffect(() => {
    if (previews.length > 0) {
      gsap.fromTo(".preview-card", 
        { opacity: 0, y: 30, scale: 0.9 },
        { opacity: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.1, ease: "back.out(1.7)" }
      );
    }
  }, [previews.length]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const {active, over} = event;

    if (over && active.id !== over.id) {
      setPreviews((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const toggleSheet = () => {
    const tl = gsap.timeline();
    if (!isSheetOpen) {
      setIsSheetOpen(true);
      setTimeout(() => {
        if (sheetRef.current) {
          gsap.fromTo(sheetRef.current, { y: "100%" }, { y: 0, duration: 0.5, ease: "power4.out" });
        }
      }, 50); // slight delay to allow render
    } else {
      if (sheetRef.current) {
        gsap.to(sheetRef.current, { y: "100%", duration: 0.4, ease: "power4.in", onComplete: () => setIsSheetOpen(false) });
      } else {
        setIsSheetOpen(false);
      }
    }
  };

  // --- Logic ---
  const handleProcess = async () => {
    if (!urls.trim() || isGenerating) return;
    
    setIsGenerating(true);
    const urlList = urls.split('\n').filter(u => u.trim() !== "");
    
    try {
      const newPreviews = await Promise.all(urlList.map(u => fetchMetadata(u.trim())));
      setPreviews(prev => [...prev, ...newPreviews]);
      setUrls("");
    } catch (error) {
      console.error("Generation failed:", error instanceof Error ? error.message : String(error));
    } finally {
      setIsGenerating(false);
    }
  };

  const removePreview = (id: string) => {
    setPreviews(previews.filter(p => p.id !== id));
  };

  const copyToClipboard = () => {
    const text = previews.map(p => 
      settings.format === 'markdown' ? `![${p.title}](${p.image})` : `<img src="${p.image}" alt="${p.title}" />`
    ).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-cyan-500/30">
      {/* Background Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full" />
        <div className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] bg-violet-600/10 blur-[120px] rounded-full" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/70 border-b border-white/10 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Layers size={18} className="text-white" />
          </div>
          <h1 className="text-lg font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            LNK.PRV
          </h1>
        </div>
        <button 
          onClick={toggleSheet}
          className="p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
        >
          <Settings2 size={20} className="text-cyan-400" />
        </button>
      </header>

      <main className="max-w-2xl mx-auto p-6 pb-32">
        {/* Input Section */}
        <section className="mb-10">
          <div className="relative group">
            <textarea
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder="Paste multiple URLs here..."
              className="w-full h-32 bg-slate-900/50 border border-white/10 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 outline-none transition-all placeholder:text-slate-600 backdrop-blur-sm"
            />
            <button 
              onClick={handleProcess}
              disabled={isGenerating}
              className={`absolute bottom-4 right-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-cyan-500/20 z-10 ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isGenerating ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  Generating...
                </div>
              ) : (
                <>
                  <Plus size={16} /> Generate
                </>
              )}
            </button>
          </div>
        </section>

        {/* Gallery */}
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={previews.map(p => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <section className="space-y-4" ref={galleryRef}>
              {previews.length === 0 && (
                <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-3xl">
                  <ImageIcon className="mx-auto text-slate-700 mb-4" size={48} />
                  <p className="text-slate-500">No previews generated yet.</p>
                </div>
              )}
              
              {previews.map((item) => (
                <SortableItem key={item.id} item={item} onRemove={removePreview} />
              ))}
            </section>
          </SortableContext>
        </DndContext>
      </main>

      {/* Export Bar (Mobile Bottom) */}
      {previews.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-30">
          <div className="bg-slate-900/80 backdrop-blur-2xl border border-white/20 rounded-2xl p-3 flex items-center justify-between shadow-2xl shadow-black">
            <div className="px-3">
              <p className="text-xs font-bold text-cyan-400 uppercase tracking-widest">{previews.length} Items</p>
              <p className="text-[10px] text-slate-400">Ready for export</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={copyToClipboard}
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl text-sm font-medium transition-all"
              >
                {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                <span className="hidden sm:inline">{copied ? "Copied" : "Copy All"}</span>
              </button>
              <button className="bg-cyan-500 text-slate-950 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-transform active:scale-95">
                <Download size={16} /> <span className="hidden sm:inline">Export</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Sheet Customizer */}
      {isSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={toggleSheet} />
          <div 
            ref={sheetRef}
            className="relative w-full max-w-lg bg-slate-900 border-t border-white/20 rounded-t-[32px] p-8 transform translate-y-full shadow-2xl"
          >
            <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-8" />
            
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Settings2 className="text-cyan-400" /> Customizer
            </h2>

            <div className="space-y-8">
              {/* Quality Slider */}
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Render Quality</span>
                  <span className="text-cyan-400 font-mono">{settings.quality}%</span>
                </div>
                <input 
                  type="range" 
                  className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  value={settings.quality}
                  onChange={(e) => setSettings({...settings, quality: parseInt(e.target.value)})}
                />
              </div>

              {/* Format Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Export Format</p>
                  <p className="text-xs text-slate-500">Choose your preferred code output</p>
                </div>
                <div className="flex bg-slate-800 p-1 rounded-xl border border-white/5">
                  {['markdown', 'html'].map((f) => (
                    <button
                      key={f}
                      onClick={() => setSettings({...settings, format: f})}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                        settings.format === f ? 'bg-cyan-500 text-slate-950 shadow-lg' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                onClick={toggleSheet}
                className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-2xl font-bold text-white shadow-xl shadow-cyan-500/20 active:scale-[0.98] transition-transform"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

