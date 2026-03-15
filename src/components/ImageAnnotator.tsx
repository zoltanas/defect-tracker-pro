import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Text } from 'react-konva';
import useImage from 'use-image';
import { X, Save, PenTool, Type, Undo, Trash2 } from 'lucide-react';
import { useDriveFile } from '../hooks/useDriveFile';

interface ImageAnnotatorProps {
  imageUrl: string;
  initialAnnotations?: string;
  onSave: (annotations: string, dataUrl?: string, file?: File) => void;
  onClose: () => void;
}

type Tool = 'pen' | 'text';

export function ImageAnnotator({ imageUrl, initialAnnotations, onSave, onClose }: ImageAnnotatorProps) {
  const { blobUrl: imageBlobUrl } = useDriveFile(imageUrl);
  const stageRef = useRef<any>(null);

  const [image] = useImage(imageBlobUrl || '');
  const [tool, setTool] = useState<Tool>('pen');
  const [lines, setLines] = useState<any[]>([]);
  const [texts, setTexts] = useState<any[]>([]);
  const isDrawing = useRef(false);

  useEffect(() => {
    if (initialAnnotations) {
      try {
        const parsed = JSON.parse(initialAnnotations);
        setLines(parsed.lines || []);
        setTexts(parsed.texts || []);
      } catch (e) {
        console.error('Failed to parse annotations', e);
      }
    }
  }, [initialAnnotations]);

  const handleMouseDown = (e: any) => {
    if (tool !== 'pen') return;
    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();
    setLines([...lines, { tool, points: [pos.x, pos.y] }]);
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing.current || tool !== 'pen') return;
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    let lastLine = lines[lines.length - 1];
    // add point
    lastLine.points = lastLine.points.concat([point.x, point.y]);
    
    // replace last
    lines.splice(lines.length - 1, 1, lastLine);
    setLines(lines.concat());
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
  };

  const handleStageClick = (e: any) => {
    if (tool === 'text') {
      const pos = e.target.getStage().getPointerPosition();
      const text = prompt('Enter text:');
      if (text) {
        setTexts([...texts, { x: pos.x, y: pos.y, text }]);
      }
    }
  };

  const handleSave = () => {
    const annotations = JSON.stringify({ lines, texts });
    let dataUrl = undefined;
    let file = undefined;
    if (stageRef.current) {
      dataUrl = stageRef.current.toDataURL({ pixelRatio: 2 });
      try {
        const arr = dataUrl.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        file = new File([u8arr], 'annotated-image.png', { type: mime });
      } catch (e) {
        console.error('Failed to convert dataUrl to File', e);
      }
    }
    onSave(annotations, dataUrl, file);
  };

  const handleClear = () => {
    if (window.confirm('Clear all annotations?')) {
      setLines([]);
      setTexts([]);
    }
  };

  return (
    <div className="fixed inset-0 bg-zinc-900/95 z-50 flex flex-col">
      <div className="min-h-[3.5rem] py-2 bg-zinc-900 border-b border-zinc-800 flex flex-wrap items-center justify-between px-4 gap-2">
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setTool('pen')}
            className={`p-2 rounded-lg ${tool === 'pen' ? 'bg-lidl-blue text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
            title="Draw"
          >
            <PenTool className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setTool('text')}
            className={`p-2 rounded-lg ${tool === 'text' ? 'bg-lidl-blue text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
            title="Add Text"
          >
            <Type className="w-5 h-5" />
          </button>
          <div className="w-px h-6 bg-zinc-700 mx-2" />
          <button 
            onClick={handleClear}
            className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white"
            title="Clear All"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-3">
          <button 
            onClick={onClose}
            className="px-3 sm:px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="inline-flex items-center px-3 sm:px-4 py-2 text-sm font-medium text-white bg-lidl-blue rounded-lg hover:bg-lidl-blue/90"
          >
            <Save className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Save Annotations</span>
            <span className="sm:hidden">Save</span>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto flex items-center justify-center p-8">
        {image ? (
          <div className="bg-white shadow-2xl ring-1 ring-white/10">
            <Stage 
              ref={stageRef}
              width={image.width} 
              height={image.height}
              onMouseDown={handleMouseDown}
              onMousemove={handleMouseMove}
              onMouseup={handleMouseUp}
              onClick={handleStageClick}
              style={{ cursor: tool === 'pen' ? 'crosshair' : 'text' }}
            >
              <Layer>
                <KonvaImage image={image} />
                {lines.map((line, i) => (
                  <Line
                    key={i}
                    points={line.points}
                    stroke="#ef4444"
                    strokeWidth={5}
                    tension={0.5}
                    lineCap="round"
                    lineJoin="round"
                  />
                ))}
                {texts.map((text, i) => (
                  <Text
                    key={i}
                    x={text.x}
                    y={text.y}
                    text={text.text}
                    fontSize={24}
                    fill="#ef4444"
                    fontFamily="Inter"
                    fontStyle="bold"
                  />
                ))}
              </Layer>
            </Stage>
          </div>
        ) : (
          <div className="text-zinc-500">Loading image...</div>
        )}
      </div>
    </div>
  );
}
