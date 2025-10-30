
import React, { useState, useCallback, useEffect, useRef, ChangeEvent } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Modality, Part } from "@google/genai";

// === TYPES ===
enum StylePreset {
  Studio = 'Professional Studio',
  Lifestyle = 'Outdoor Lifestyle',
  Social = 'Social Media Aesthetic',
  Ecommerce = 'E-commerce (Amazon-style plain background)',
}

enum AspectRatio {
  Landscape = '16:9',
  Portrait = '9:16',
  Square = '1:1',
}

interface StockImage {
  id: string;
  url: string;
  alt: string;
}

// === CONSTANTS ===
const STOCK_MODEL_IMAGES: StockImage[] = [
  { id: 'model1', url: 'https://picsum.photos/id/1027/512/512', alt: 'Woman in a city' },
  { id: 'model2', url: 'https://picsum.photos/id/1005/512/512', alt: 'Man with a camera' },
  { id: 'model3', url: 'https://picsum.photos/id/1011/512/512', alt: 'Woman on a boat' },
  { id: 'model4', url: 'https://picsum.photos/id/1012/512/512', alt: 'Man hiking' },
];

const LOADING_MESSAGES = [
  "AI is crafting your vision...",
  "Blending pixels and creativity...",
  "Applying the perfect lighting...",
  "Compositing the scene...",
  "Finalizing the artistic details...",
  "Almost there, the magic is happening!",
];

// === GEMINI SERVICE ===
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result.split(',')[1]);
            } else {
                reject(new Error('Failed to convert file to base64'));
            }
        };
        reader.onerror = error => reject(error);
    });
};

const urlToMimeType = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return blob.type;
};

const urlToBase64 = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result.split(',')[1]);
            } else {
                reject(new Error('Failed to convert URL content to base64'));
            }
        };
        reader.onerror = reject;
    });
};

const generateProductShoot = async (
    modelImage: File | string,
    productImage: File,
    prompt: string,
    style: StylePreset,
    aspectRatio: AspectRatio
): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const productMimeType = productImage.type;
    const productBase64 = await fileToBase64(productImage);

    let modelMimeType: string;
    let modelBase64: string;

    if (typeof modelImage === 'string') { // It's a URL
        modelMimeType = await urlToMimeType(modelImage);
        modelBase64 = await urlToBase64(modelImage);
    } else { // It's a File
        modelMimeType = modelImage.type;
        modelBase64 = await fileToBase64(modelImage);
    }

    const modelImagePart: Part = {
        inlineData: { data: modelBase64, mimeType: modelMimeType },
    };

    const productImagePart: Part = {
        inlineData: { data: productBase64, mimeType: productMimeType },
    };

    const textPromptPart: Part = {
        text: `
        As an expert AI photoshoot director, your task is to composite a product into a model's photo.
        You are given two images: the first is the model, and the second is the product.
        
        Creative brief: "${prompt}"
        
        Your goal is to seamlessly and realistically integrate the product into the model's setting (e.g., in their hand, on a table nearby, worn by them), following the creative brief precisely.
        
        Key requirements for the final image:
        1.  **Style:** The image must have a "${style}" aesthetic.
        2.  **Realism:** Ensure lighting, shadows, reflections, and perspective on the product match the model's environment perfectly.
        3.  **Composition:** The product should be naturally placed and be the focal point without looking artificial.
        4.  **Aspect Ratio:** The final output image must have an aspect ratio of ${aspectRatio}.
        
        Generate a single, high-resolution, photorealistic image based on these instructions.
        `,
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [modelImagePart, productImagePart, textPromptPart],
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            const base64ImageBytes: string = part.inlineData.data;
            return `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
        }
    }
    
    throw new Error('No image was generated in the response.');
};


// === COMPONENTS ===
const LoadingSpinner: React.FC = () => {
  return (
    <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-cyan-400"></div>
  );
};

const ParticleBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    
    class Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      color: string;

      constructor(x: number, y: number, size: number, speedX: number, speedY: number, color: string) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.speedX = speedX;
        this.speedY = speedY;
        this.color = color;
      }

      update() {
        if (!canvas) return;
        if (this.x > canvas.width || this.x < 0) this.speedX *= -1;
        if (this.y > canvas.height || this.y < 0) this.speedY *= -1;
        this.x += this.speedX;
        this.y += this.speedY;
      }

      draw() {
        if (!ctx) return;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    let particles: Particle[] = [];

    const resizeCanvas = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const init = () => {
      if (!canvas) return;
      particles = [];
      const numberOfParticles = (canvas.height * canvas.width) / 9000;
      for (let i = 0; i < numberOfParticles; i++) {
        const size = Math.random() * 2 + 0.5;
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const speedX = Math.random() * 0.6 - 0.3;
        const speedY = Math.random() * 0.6 - 0.3;
        const colors = ['#5DADE2', '#8E44AD', '#E8DAEF', '#FFFFFF'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        particles.push(new Particle(x, y, size, speedX, speedY, color));
      }
    };

    const animate = () => {
        if (!ctx || !canvas) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const particle of particles) {
            particle.update();
            particle.draw();
        }
        animationFrameId = requestAnimationFrame(animate);
    };

    const handleResize = () => {
      resizeCanvas();
      init();
    };

    resizeCanvas();
    init();
    animate();

    window.addEventListener('resize', handleResize);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full z-0"
      style={{ backgroundColor: '#0c0c1c' }}
    />
  );
};

const Header: React.FC = () => {
  return (
    <header className="text-center">
      <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 via-purple-400 to-pink-400">
        Life Image Studio Pro
      </h1>
      <p className="mt-2 text-lg text-gray-400">Your Personal AI Product Shoot Studio</p>
    </header>
  );
};

type ImageUploaderProps = {
  title: string;
} & (
  | {
      onImageSelect: (file: File) => void;
      stockImages?: undefined;
    }
  | {
      onImageSelect: (file: File | string) => void;
      stockImages: StockImage[];
    }
);

const UploadIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
);

const ImageUploader: React.FC<ImageUploaderProps> = ({ title, onImageSelect, stockImages }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'stock'>(stockImages ? 'stock' : 'upload');

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
        onImageSelect(file);
      };
      reader.readAsDataURL(file);
    }
  }, [onImageSelect]);

  const handleStockImageSelect = useCallback((image: StockImage) => {
    setPreview(image.url);
    if (stockImages) {
        onImageSelect(image.url);
    }
  }, [onImageSelect, stockImages]);

  const inputId = `file-upload-${title.replace(/\s+/g, '-')}`;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold text-gray-300">{title}</h3>
      {stockImages && (
        <div className="flex bg-gray-800/50 rounded-lg p-1 border border-gray-700">
          <button onClick={() => setActiveTab('stock')} className={`flex-1 py-1 rounded-md text-sm transition ${activeTab === 'stock' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>Stock</button>
          <button onClick={() => setActiveTab('upload')} className={`flex-1 py-1 rounded-md text-sm transition ${activeTab === 'upload' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>Upload</button>
        </div>
      )}
      <div className="aspect-square w-full rounded-lg border-2 border-dashed border-gray-600 hover:border-cyan-400 transition-colors duration-300 bg-gray-900/50 flex items-center justify-center relative overflow-hidden">
        {preview ? (
          <img src={preview} alt="Preview" className="w-full h-full object-cover" />
        ) : (
          activeTab === 'upload' && (
            <div className="text-center text-gray-500">
                <UploadIcon />
                <p className="mt-2 text-sm">Click to upload</p>
            </div>
          )
        )}
        {activeTab === 'upload' ? (
          <input
            id={inputId}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-label={`Upload ${title}`}
          />
        ) : null }

        {activeTab === 'stock' && !preview && (
           <p className="text-gray-500 text-sm">Select a model below</p>
        )}
      </div>

      {stockImages && activeTab === 'stock' && (
        <div className="grid grid-cols-4 gap-2 mt-2">
          {stockImages.map(img => (
            <button key={img.id} onClick={() => handleStockImageSelect(img)} className={`rounded-md overflow-hidden border-2 transition ${preview === img.url ? 'border-cyan-400' : 'border-transparent hover:border-cyan-500/50'}`}>
              <img src={img.url} alt={img.alt} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
}

const PromptInput: React.FC<PromptInputProps> = ({ value, onChange }) => {
  return (
    <div className="w-full">
       <h3 className="text-lg font-semibold text-gray-300 mb-3">Creative Prompt</h3>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g., A model holding the product in a futuristic city at night..."
        className="w-full h-24 p-4 rounded-lg bg-gray-900/80 border-2 border-gray-700 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/20 text-gray-200 placeholder-gray-500 transition-all duration-300 ease-in-out resize-none focus:outline-none shadow-[0_0_15px_rgba(0,180,255,0.2)] focus:shadow-[0_0_25px_rgba(0,220,255,0.4)]"
      />
    </div>
  );
};

interface StylePresetsProps {
  selectedStyle: StylePreset;
  onStyleChange: (style: StylePreset) => void;
  selectedAspectRatio: AspectRatio;
  onAspectRatioChange: (ratio: AspectRatio) => void;
}

const StylePresets: React.FC<StylePresetsProps> = ({
  selectedStyle,
  onStyleChange,
  selectedAspectRatio,
  onAspectRatioChange,
}) => {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-300 mb-3">Style Preset</h3>
        <div className="grid grid-cols-2 gap-3">
          {Object.values(StylePreset).map((style) => (
            <button
              key={style}
              onClick={() => onStyleChange(style)}
              className={`p-3 text-sm rounded-md transition-all duration-300 border-2 ${
                selectedStyle === style
                  ? 'bg-blue-600 border-cyan-400 text-white shadow-[0_0_10px_rgba(0,220,255,0.4)]'
                  : 'bg-gray-800 border-gray-700 hover:bg-gray-700 hover:border-gray-500 text-gray-300'
              }`}
            >
              {style}
            </button>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-gray-300 mb-3">Image Size</h3>
        <select
          value={selectedAspectRatio}
          onChange={(e) => onAspectRatioChange(e.target.value as AspectRatio)}
          className="w-full p-3 rounded-lg bg-gray-900/80 border-2 border-gray-700 focus:border-purple-400 focus:ring-4 focus:ring-purple-400/20 text-gray-200 focus:outline-none"
        >
          {Object.values(AspectRatio).map((ratio) => (
            <option key={ratio} value={ratio}>
              {ratio}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};


interface SliderProps {
  label: string;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  min?: number;
  max?: number;
  step?: number;
}
const EditorSlider: React.FC<SliderProps> = ({ label, value, onChange, min = 0, max = 200, step = 1 }) => (
  <div className="flex flex-col gap-2">
    <div className="flex justify-between items-center text-sm">
      <label htmlFor={label} className="text-gray-400">{label}</label>
      <span className="font-mono text-cyan-300 bg-gray-800 px-2 py-0.5 rounded">{value}</span>
    </div>
    <input
      id={label}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={onChange}
      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
    />
  </div>
);

interface OutputDisplayProps {
  originalImage: File | null;
  generatedImage: string | null;
  brightness: number;
  setBrightness: (v: number) => void;
  contrast: number;
  setContrast: (v: number) => void;
  saturate: number;
  setSaturate: (v: number) => void;
  sepia: number;
  setSepia: (v: number) => void;
  grayscale: number;
  setGrayscale: (v: number) => void;
  resetEdits: () => void;
}

const Placeholder: React.FC<{text: string}> = ({text}) => (
    <div className="aspect-square w-full bg-gray-900/50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-700">
        <p className="text-gray-500">{text}</p>
    </div>
);

const OutputDisplay: React.FC<OutputDisplayProps> = ({ 
    originalImage, 
    generatedImage,
    brightness, setBrightness,
    contrast, setContrast,
    saturate, setSaturate,
    sepia, setSepia,
    grayscale, setGrayscale,
    resetEdits
 }) => {
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (originalImage) {
      const url = URL.createObjectURL(originalImage);
      setOriginalImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setOriginalImageUrl(null)
  }, [originalImage]);

  const filterStyle = {
    filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%) sepia(${sepia}%) grayscale(${grayscale}%)`
  };

  const isEdited = brightness !== 100 || contrast !== 100 || saturate !== 100 || sepia !== 0 || grayscale !== 0;

  const handleDownload = () => {
    if (!generatedImage) return;

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.filter = filterStyle.filter;
        ctx.drawImage(image, 0, 0);

        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `life-image-studio-pro-${isEdited ? 'edited' : 'output'}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    image.src = generatedImage;
  };

  const applyGrayscale = () => {
    resetEdits();
    setSaturate(0);
    setGrayscale(100);
  };
  
  const applySepia = () => {
    resetEdits();
    setSepia(100);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="font-bold text-center mb-2 text-gray-400">Original Product</h4>
          {originalImageUrl ? (
            <img src={originalImageUrl} alt="Original Product" className="w-full h-auto object-contain rounded-lg" />
          ) : (
            <Placeholder text="Your product image"/>
          )}
        </div>
        <div>
          <h4 className="font-bold text-center mb-2 text-gray-400">AI Generated Photoshoot</h4>
          {generatedImage ? (
            <img src={generatedImage} alt="Generated Photoshoot" style={filterStyle} className="w-full h-auto object-contain rounded-lg transition-all duration-300" />
          ) : (
             <Placeholder text="Your result will appear here"/>
          )}
        </div>
      </div>
      {generatedImage && (
        <div className="flex flex-col gap-4">
            <div className="p-4 bg-black bg-opacity-40 backdrop-blur-sm rounded-lg border border-gray-700">
                <h3 className="text-lg font-semibold text-gray-300 mb-4 text-center">Image Editor</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <EditorSlider label="Brightness" value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} />
                    <EditorSlider label="Contrast" value={contrast} onChange={(e) => setContrast(Number(e.target.value))} />
                    <EditorSlider label="Saturation" value={saturate} onChange={(e) => setSaturate(Number(e.target.value))} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                    <button onClick={applyGrayscale} className={`py-2 text-sm rounded-md transition-all duration-300 border-2 ${grayscale > 0 ? 'bg-blue-600 border-cyan-400 text-white' : 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-300'}`}>Grayscale</button>
                    <button onClick={applySepia} className={`py-2 text-sm rounded-md transition-all duration-300 border-2 ${sepia > 0 ? 'bg-blue-600 border-cyan-400 text-white' : 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-300'}`}>Sepia</button>
                    <button onClick={resetEdits} className="py-2 text-sm rounded-md transition-all duration-300 border-2 bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-300">Reset</button>
                </div>
            </div>

            <button
              onClick={handleDownload}
              className="w-full py-3 text-md font-bold rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105 bg-gradient-to-r from-purple-500 to-pink-500 hover:shadow-lg hover:shadow-purple-500/50 text-white"
            >
              {isEdited ? 'Download Edited Image' : 'Download Image'}
            </button>
        </div>
      )}
    </div>
  );
};


// === MAIN APP COMPONENT ===
const App: React.FC = () => {
  const [modelImage, setModelImage] = useState<File | string | null>(null);
  const [productImage, setProductImage] = useState<File | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [style, setStyle] = useState<StylePreset>(StylePreset.Studio);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.Square);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>(LOADING_MESSAGES[0]);
  
  // State for image editing
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [saturate, setSaturate] = useState<number>(100);
  const [sepia, setSepia] = useState<number>(0);
  const [grayscale, setGrayscale] = useState<number>(0);

  const resetEdits = useCallback(() => {
    setBrightness(100);
    setContrast(100);
    setSaturate(100);
    setSepia(0);
    setGrayscale(0);
  }, []);

  useEffect(() => {
    let intervalId: number | null = null;
    if (isLoading) {
      setLoadingMessage(LOADING_MESSAGES[0]); // Reset to the first message on new load
      intervalId = window.setInterval(() => {
        setLoadingMessage(prevMessage => {
          const currentIndex = LOADING_MESSAGES.indexOf(prevMessage);
          const nextIndex = (currentIndex + 1) % LOADING_MESSAGES.length;
          return LOADING_MESSAGES[nextIndex];
        });
      }, 2500);
    }

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [isLoading]);

  const handleGenerateClick = useCallback(async () => {
    if (!modelImage || !productImage) {
      setError('Please upload both a model and a product image.');
      return;
    }
    if (!prompt.trim()) {
      setError('Please provide a creative prompt.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);
    resetEdits(); // Reset edits for the new image

    try {
      const result = await generateProductShoot(modelImage, productImage, prompt, style, aspectRatio);
      setGeneratedImage(result);
    } catch (err) {
      console.error(err);
      if (err instanceof Error) {
        setError(`Failed to generate image: ${err.message}. Please check the console for details.`);
      } else {
        setError('An unknown error occurred while generating the image.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [modelImage, productImage, prompt, style, aspectRatio, resetEdits]);

  const canGenerate = modelImage && productImage && prompt.trim() && !isLoading;

  return (
    <div className="relative min-h-screen bg-black text-white font-sans overflow-x-hidden">
      <ParticleBackground />
      <div className="relative z-10 container mx-auto px-4 py-8">
        <Header />

        <main className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div className="flex flex-col gap-8 p-6 bg-black bg-opacity-30 backdrop-blur-sm rounded-2xl border border-blue-500/20 shadow-lg shadow-blue-500/10">
            
            <h2 className="text-2xl font-bold text-center text-gray-200 tracking-wider">1. Upload Your Assets</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ImageUploader title="Model Photo" onImageSelect={setModelImage} stockImages={STOCK_MODEL_IMAGES} />
              <ImageUploader title="Product Photo" onImageSelect={setProductImage} />
            </div>

            <h2 className="text-2xl font-bold text-center text-gray-200 tracking-wider mt-4">2. Define Your Vision</h2>
            <PromptInput value={prompt} onChange={setPrompt} />
            <StylePresets
              selectedStyle={style}
              onStyleChange={setStyle}
              selectedAspectRatio={aspectRatio}
              onAspectRatioChange={setAspectRatio}
            />

            <button
              onClick={handleGenerateClick}
              disabled={!canGenerate}
              className={`w-full py-4 text-lg font-bold rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105
                ${canGenerate
                  ? 'bg-gradient-to-r from-cyan-400 to-blue-600 hover:shadow-lg hover:shadow-cyan-400/50 text-white'
                  : 'bg-gray-700 cursor-not-allowed text-gray-400'
                }`}
            >
              {isLoading ? 'Generating...' : '✨ Generate Photoshoot'}
            </button>
            {error && <p className="text-red-400 text-center mt-2">{error}</p>}
          </div>

          <div className="flex flex-col gap-8 p-6 bg-black bg-opacity-30 backdrop-blur-sm rounded-2xl border border-purple-500/20 shadow-lg shadow-purple-500/10 sticky top-8">
            <h2 className="text-2xl font-bold text-center text-gray-200 tracking-wider">3. The Result</h2>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-96">
                <LoadingSpinner />
                <p className="mt-4 text-lg text-gray-300 text-center">{loadingMessage}</p>
              </div>
            ) : (
              <OutputDisplay
                originalImage={productImage}
                generatedImage={generatedImage}
                brightness={brightness}
                setBrightness={setBrightness}
                contrast={contrast}
                setContrast={setContrast}
                saturate={saturate}
                setSaturate={setSaturate}
                sepia={sepia}
                setSepia={setSepia}
                grayscale={grayscale}
                setGrayscale={setGrayscale}
                resetEdits={resetEdits}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

// === RENDER APP ===
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
