/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, 
  Square, 
  Play, 
  RotateCcw, 
  BookOpen, 
  Languages, 
  Volume2, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  ChevronRight,
  Sparkles,
  Trophy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  generateVstepContent, 
  generateVstepPart3Content,
  generateAudio, 
  scoreSpeech, 
  VstepContent, 
  VstepScore,
  VstepLevel
} from './services/geminiService';

// Speech Recognition Type Definition
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: any) => void;
  onend: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

type View = 'selection' | 'part2' | 'part3';

export default function App() {
  const [view, setView] = useState<View>('selection');
  const [topic, setTopic] = useState('If you win 1 billion VND, what will you do?');
  const [optionA, setOptionA] = useState('buy gold');
  const [optionB, setOptionB] = useState('buy a house');
  const [optionC, setOptionC] = useState('save money in the bank');
  
  const [idea1, setIdea1] = useState('Career opportunities');
  const [idea2, setIdea2] = useState('Cultural understanding');
  const [idea3, setIdea3] = useState('Brain development');

  const [selectedLevel, setSelectedLevel] = useState<VstepLevel>('B2');
  
  const [playbackRate, setPlaybackRate] = useState(1);
  
  const [isLoading, setIsLoading] = useState(false);
  const [content, setContent] = useState<VstepContent | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isScoring, setIsScoring] = useState(false);
  const [score, setScore] = useState<VstepScore | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      if (recognitionRef.current) {
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          setTranscript(prev => prev + finalTranscript);
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error', event.error);
          setIsRecording(false);
        };

        recognitionRef.current.onend = () => {
          setIsRecording(false);
        };
      }
    }
  }, []);

  const handleGenerate = async () => {
    // Check both process.env (replaced at build time) and import.meta.env (Vite's standard)
    const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
    
    if (!apiKey || apiKey === '""' || apiKey === "''") {
      alert("Lỗi: Không tìm thấy GEMINI_API_KEY.\n\nCÁCH SỬA DỨT ĐIỂM TRÊN VERCEL:\n1. Vào Settings -> Environment Variables.\n2. Thêm biến mới với tên là: VITE_GEMINI_API_KEY (phải có chữ VITE_ ở đầu).\n3. Dán mã API vào phần Value và nhấn Save.\n4. QUAN TRỌNG: Vào tab Deployments, nhấn dấu '...' ở bản mới nhất và chọn 'Redeploy'.");
      return;
    }

    setIsLoading(true);
    setContent(null);
    setAudioUrl(null);
    setScore(null);
    setTranscript('');
    
    try {
      // 1. Generate Text Content First (using Flash model for speed)
      let result;
      if (view === 'part2') {
        result = await generateVstepContent(topic, optionA, optionB, optionC, selectedLevel);
      } else {
        result = await generateVstepPart3Content(topic, [idea1, idea2, idea3].filter(i => i.trim() !== ''), selectedLevel);
      }
      setContent(result);
      
      // 2. Generate Audio in background using the EXACT sample answer text
      generateAudio(result.sampleAnswer).then(audio => {
        if (audio) setAudioUrl(audio);
      }).catch(e => {
        console.error("Audio generation failed:", e);
      });
      
    } catch (error) {
      console.error("Error generating content:", error);
      alert("Có lỗi xảy ra khi tạo bài mẫu. Vui lòng kiểm tra kết nối mạng hoặc API key.");
    } finally {
      setIsLoading(false);
    }
  };

  const playAudio = () => {
    if (audioRef.current) {
      // Reset audio to start if it was already playing or finished
      audioRef.current.currentTime = 0;
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.play().catch(e => {
        console.error("Audio play failed:", e);
        alert("Không thể phát âm thanh. Vui lòng thử lại.");
      });
    } else {
      console.warn("Audio element not found");
    }
  };

  const startRecording = () => {
    setTranscript('');
    setScore(null);
    if (recognitionRef.current) {
      recognitionRef.current.start();
      setIsRecording(true);
    } else {
      alert("Trình duyệt của bạn không hỗ trợ nhận diện giọng nói (Speech Recognition). Vui lòng sử dụng Chrome hoặc Edge trên máy tính để có trải nghiệm tốt nhất.");
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleScore = async () => {
    if (!content || !transcript) return;
    setIsScoring(true);
    try {
      const result = await scoreSpeech(content.sampleAnswer, transcript);
      setScore(result);
    } catch (error) {
      console.error("Error scoring speech:", error);
    } finally {
      setIsScoring(false);
    }
  };

  const resetState = (newView: View) => {
    setView(newView);
    setContent(null);
    setAudioUrl(null);
    setScore(null);
    setTranscript('');
    if (newView === 'part2') {
      setTopic('If you win 1 billion VND, what will you do?');
    } else {
      setTopic('The benefits of learning a foreign language');
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F2ED] text-[#1a1a1a] font-sans selection:bg-emerald-100">
      {/* Header */}
      <header className="border-b border-black/5 bg-white/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => resetState('selection')}>
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
              <Sparkles size={18} />
            </div>
            <h1 className="font-semibold text-lg tracking-tight">VSTEP Speaking AI Coach</h1>
          </div>
          <div className="flex items-center gap-4">
            <nav className="hidden md:flex gap-6 text-xs font-bold uppercase tracking-widest text-black/40 mr-4">
              <button 
                onClick={() => resetState('part2')}
                className={`hover:text-emerald-600 transition-colors ${view === 'part2' ? 'text-emerald-600' : ''}`}
              >
                Part 2
              </button>
              <button 
                onClick={() => resetState('part3')}
                className={`hover:text-emerald-600 transition-colors ${view === 'part3' ? 'text-emerald-600' : ''}`}
              >
                Part 3
              </button>
            </nav>
            <div className="flex bg-[#F5F2ED] p-1 rounded-xl border border-black/5">
              {(['B1', 'B2', 'C1'] as VstepLevel[]).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setSelectedLevel(lvl)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedLevel === lvl 
                      ? 'bg-emerald-600 text-white shadow-sm' 
                      : 'text-black/40 hover:text-black/60'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {view === 'selection' ? (
          <div className="grid md:grid-cols-2 gap-8 py-12">
            <motion.div 
              whileHover={{ y: -5 }}
              onClick={() => resetState('part2')}
              className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-black/5 cursor-pointer group"
            >
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-8 group-hover:scale-110 transition-transform">
                <BookOpen size={28} />
              </div>
              <h2 className="text-3xl font-serif italic mb-4">Part 2: Solution Discussion</h2>
              <p className="text-black/40 leading-relaxed mb-8">
                Thảo luận giải pháp cho một tình huống cụ thể. Bạn sẽ chọn một trong ba phương án và giải thích lý do.
              </p>
              <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm uppercase tracking-widest">
                Bắt đầu luyện tập <ChevronRight size={16} />
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ y: -5 }}
              onClick={() => resetState('part3')}
              className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-black/5 cursor-pointer group"
            >
              <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 mb-8 group-hover:scale-110 transition-transform">
                <Sparkles size={28} />
              </div>
              <h2 className="text-3xl font-serif italic mb-4">Part 3: Topic Development</h2>
              <p className="text-black/40 leading-relaxed mb-8">
                Phát triển một chủ đề dựa trên sơ đồ gợi ý. Bạn sẽ trình bày quan điểm và mở rộng ý tưởng của mình.
              </p>
              <div className="flex items-center gap-2 text-purple-600 font-bold text-sm uppercase tracking-widest">
                Bắt đầu luyện tập <ChevronRight size={16} />
              </div>
            </motion.div>
          </div>
        ) : (
          <>
            {/* Input Section */}
            <section className="mb-12">
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-black/5">
                <h2 className="text-2xl font-serif italic mb-6 flex items-center gap-2">
                  <BookOpen className="text-emerald-600" size={24} />
                  {view === 'part2' ? 'Tạo đề thảo luận giải pháp' : 'Tạo đề phát triển chủ đề'}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-black/40 mb-2">Topic</label>
                    <input 
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="w-full bg-[#F5F2ED] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      placeholder="Nhập chủ đề..."
                    />
                  </div>
                  {view === 'part2' ? (
                    <>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-black/40 mb-2">Option A (Best Choice)</label>
                        <input 
                          value={optionA}
                          onChange={(e) => setOptionA(e.target.value)}
                          className="w-full bg-[#F5F2ED] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          placeholder="Lựa chọn tốt nhất..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-black/40 mb-2">Option B</label>
                        <input 
                          value={optionB}
                          onChange={(e) => setOptionB(e.target.value)}
                          className="w-full bg-[#F5F2ED] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          placeholder="Lựa chọn 2..."
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold uppercase tracking-wider text-black/40 mb-2">Option C</label>
                        <input 
                          value={optionC}
                          onChange={(e) => setOptionC(e.target.value)}
                          className="w-full bg-[#F5F2ED] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          placeholder="Lựa chọn 3..."
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-black/40 mb-2">Idea 1</label>
                        <input 
                          value={idea1}
                          onChange={(e) => setIdea1(e.target.value)}
                          className="w-full bg-[#F5F2ED] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          placeholder="Ý tưởng 1..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-black/40 mb-2">Idea 2</label>
                        <input 
                          value={idea2}
                          onChange={(e) => setIdea2(e.target.value)}
                          className="w-full bg-[#F5F2ED] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          placeholder="Ý tưởng 2..."
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold uppercase tracking-wider text-black/40 mb-2">Idea 3</label>
                        <input 
                          value={idea3}
                          onChange={(e) => setIdea3(e.target.value)}
                          className="w-full bg-[#F5F2ED] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          placeholder="Ý tưởng 3..."
                        />
                      </div>
                    </>
                  )}
                </div>
                <button 
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className="mt-8 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="animate-spin" /> : <Sparkles size={20} />}
                  {isLoading ? 'Đang tạo bài mẫu...' : `Tạo bài nói mẫu (${selectedLevel})`}
                </button>
              </div>
            </section>

        <AnimatePresence mode="wait">
          {content && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              {/* Sample Answer Section */}
              <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  <div className="bg-white rounded-3xl p-8 shadow-sm border border-black/5">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-serif italic flex items-center gap-2">
                          <CheckCircle2 className="text-emerald-600" size={22} />
                          Sample Speaking Answer
                        </h3>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-md uppercase">{content.level}</span>
                      </div>
                      {audioUrl && (
                        <div className="flex items-center gap-2">
                          <div className="flex bg-emerald-50 p-1 rounded-full border border-emerald-100 mr-2">
                            {[0.75, 1, 1.25].map((rate) => (
                              <button
                                key={rate}
                                onClick={() => setPlaybackRate(rate)}
                                className={`px-2 py-1 rounded-full text-[10px] font-bold transition-all ${
                                  playbackRate === rate 
                                    ? 'bg-emerald-600 text-white shadow-sm' 
                                    : 'text-emerald-700/60 hover:text-emerald-700'
                                }`}
                              >
                                {rate}x
                              </button>
                            ))}
                          </div>
                          <button 
                            onClick={playAudio}
                            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-full hover:bg-emerald-700 transition-all shadow-sm"
                          >
                            <Volume2 size={18} />
                            <span className="text-xs font-bold">Listen</span>
                          </button>
                          <audio key={audioUrl} ref={audioRef} src={audioUrl} className="hidden" />
                        </div>
                      )}
                    </div>
                    <p className="text-lg leading-relaxed text-black/80 whitespace-pre-wrap">
                      {content.sampleAnswer}
                    </p>
                  </div>

                  <div className="bg-emerald-900 text-white rounded-3xl p-8 shadow-xl">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-serif italic flex items-center gap-2">
                        <Mic size={22} />
                        Luyện Đọc Mẫu (Reading Practice)
                      </h3>
                      {audioUrl && (
                        <button 
                          onClick={playAudio}
                          className="flex items-center gap-2 bg-white/10 text-white px-4 py-2 rounded-full hover:bg-white/20 transition-all border border-white/10"
                        >
                          <Volume2 size={18} />
                          <span className="text-xs font-bold">Listen</span>
                        </button>
                      )}
                    </div>
                    <div className="space-y-4 font-medium text-emerald-50/90 text-lg">
                      {content.practiceVersion.split('\n').map((line, i) => (
                        <p key={i} className="border-l-2 border-emerald-500/30 pl-4 py-1 hover:border-emerald-400 transition-colors">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="bg-white rounded-3xl p-8 shadow-sm border border-black/5">
                    <h3 className="text-xl font-serif italic mb-6 flex items-center gap-2">
                      <Languages className="text-emerald-600" size={22} />
                      Dịch Tiếng Việt
                    </h3>
                    <p className="text-black/60 leading-relaxed italic">
                      {content.translation}
                    </p>
                  </div>

                  <div className="bg-white rounded-3xl p-8 shadow-sm border border-black/5 overflow-hidden">
                    <h3 className="text-xl font-serif italic mb-6 flex items-center gap-2">
                      <BookOpen className="text-emerald-600" size={22} />
                      Key Vocabulary
                    </h3>
                    <div className="space-y-6">
                      {content.vocabulary.map((v, i) => (
                        <div key={i} className="group">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="font-bold text-emerald-700">{v.word}</span>
                            <span className="text-xs text-black/40">— {v.meaning}</span>
                          </div>
                          <p className="text-sm text-black/60 italic group-hover:text-black/80 transition-colors">
                            "{v.example}"
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl p-8 shadow-sm border border-black/5">
                    <h3 className="text-xl font-serif italic mb-6 flex items-center gap-2">
                      <Sparkles className="text-emerald-600" size={22} />
                      Idea Mindmap
                    </h3>
                    <div className="relative">
                      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-6 text-center">
                        <span className="text-xs font-bold uppercase tracking-widest text-emerald-800/40 block mb-1">Central Idea</span>
                        <p className="font-bold text-emerald-900">{content.mindmap.centralIdea}</p>
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        {content.mindmap.nodes.map((node, i) => (
                          <div key={i} className="bg-[#F5F2ED] rounded-2xl p-4 border border-black/5">
                            <h4 className="font-bold text-sm text-emerald-800 mb-2 uppercase tracking-wide">{node.title}</h4>
                            <ul className="space-y-1">
                              {node.details.map((detail, j) => (
                                <li key={j} className="text-sm text-black/60 flex items-start gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                                  <span>{detail}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Practice Mode Section */}
              <section className="bg-white rounded-[2.5rem] p-12 shadow-2xl border border-emerald-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full -mr-32 -mt-32 blur-3xl opacity-50" />
                
                <div className="relative z-10">
                  <div className="text-center max-w-2xl mx-auto mb-12">
                    <h2 className="text-3xl font-serif italic mb-4">Speaking Practice Mode</h2>
                    <p className="text-black/50">Ghi âm bài nói của bạn để AI chấm điểm theo tiêu chuẩn VSTEP.</p>
                  </div>

                  <div className="flex flex-col items-center gap-8">
                    <div className="relative">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-lg ${
                          isRecording 
                            ? 'bg-red-500 hover:bg-red-600 shadow-red-200' 
                            : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                        }`}
                      >
                        {isRecording ? <Square fill="white" size={32} className="text-white" /> : <Mic size={40} className="text-white" />}
                      </motion.button>
                      {isRecording && (
                        <motion.div 
                          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="absolute inset-0 bg-red-500 rounded-full -z-10"
                        />
                      )}
                    </div>

                    <div className="w-full max-w-3xl bg-[#F5F2ED] rounded-3xl p-8 min-h-[150px] relative">
                      <div className="absolute top-4 left-4 text-[10px] font-bold uppercase tracking-widest text-black/20">Your Transcript</div>
                      <p className="text-lg text-black/70 leading-relaxed pt-4">
                        {transcript || (isRecording ? "Listening..." : "Nhấn nút để bắt đầu nói...")}
                      </p>
                    </div>

                    {transcript && !isRecording && (
                      <div className="flex gap-4">
                        <button 
                          onClick={() => setTranscript('')}
                          className="px-8 py-3 rounded-xl border border-black/10 hover:bg-black/5 transition-all flex items-center gap-2 font-medium"
                        >
                          <RotateCcw size={18} /> Thử lại
                        </button>
                        <button 
                          onClick={handleScore}
                          disabled={isScoring}
                          className="px-8 py-3 rounded-xl bg-black text-white hover:bg-black/80 transition-all flex items-center gap-2 font-medium disabled:opacity-50"
                        >
                          {isScoring ? <Loader2 className="animate-spin" /> : <Trophy size={18} />}
                          {isScoring ? 'Đang chấm điểm...' : 'Chấm điểm ngay'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Score Display */}
                  <AnimatePresence>
                    {score && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-16 pt-16 border-t border-black/5"
                      >
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                          <div>
                            <div className="flex items-center gap-4 mb-8">
                              <div className="w-20 h-20 bg-emerald-600 rounded-2xl flex flex-col items-center justify-center text-white shadow-xl shadow-emerald-100">
                                <span className="text-3xl font-bold">{score.overall}</span>
                                <span className="text-[10px] font-bold uppercase tracking-tighter">Overall</span>
                              </div>
                              <div>
                                <h4 className="text-2xl font-serif italic">VSTEP Score Card</h4>
                                <p className="text-black/40 text-sm">Dựa trên tiêu chuẩn chấm thi B1-B2</p>
                              </div>
                            </div>

                            <div className="space-y-6">
                              {[
                                { label: 'Fluency', score: score.fluency, feedback: score.feedback.fluency },
                                { label: 'Grammar', score: score.grammar, feedback: score.feedback.grammar },
                                { label: 'Vocabulary', score: score.vocabulary, feedback: score.feedback.vocabulary },
                                { label: 'Pronunciation', score: score.pronunciation, feedback: score.feedback.pronunciation },
                                { label: 'Task Response', score: score.taskResponse, feedback: score.feedback.taskResponse },
                              ].map((item, i) => (
                                <div key={i} className="space-y-2">
                                  <div className="flex justify-between items-end">
                                    <span className="font-bold text-sm uppercase tracking-wider text-black/60">{item.label}</span>
                                    <span className="font-bold text-emerald-600">{item.score}/10</span>
                                  </div>
                                  <div className="h-2 bg-black/5 rounded-full overflow-hidden">
                                    <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: `${item.score * 10}%` }}
                                      className="h-full bg-emerald-600"
                                    />
                                  </div>
                                  <p className="text-xs text-black/50 italic">{item.feedback}</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="bg-[#F5F2ED] rounded-3xl p-8">
                            <h4 className="text-xl font-serif italic mb-6 flex items-center gap-2">
                              <AlertCircle className="text-emerald-600" size={22} />
                              Suggestions for Improvement
                            </h4>
                            <ul className="space-y-4">
                              {score.suggestions.map((s, i) => (
                                <li key={i} className="flex gap-3 text-black/70">
                                  <ChevronRight className="text-emerald-600 shrink-0" size={18} />
                                  <span>{s}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
          </>
        )}

        {view !== 'selection' && !content && !isLoading && (
          <div className="text-center py-24 opacity-20">
            <Sparkles size={64} className="mx-auto mb-4" />
            <p className="text-xl font-serif italic">Nhập đề bài để bắt đầu luyện tập</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-black/5 py-12 bg-white/30">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-black/30">
            AI-Powered VSTEP Speaking Coach • 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
