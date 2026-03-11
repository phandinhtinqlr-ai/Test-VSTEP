import { GoogleGenAI, Type, Modality } from "@google/genai";

const getApiKey = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.warn("GEMINI_API_KEY is not defined. Please set it in your environment variables.");
  }
  return key || "";
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

export type VstepLevel = 'B1' | 'B2' | 'C1';

export interface VstepContent {
  topic: string;
  sampleAnswer: string;
  practiceVersion: string;
  translation: string;
  vocabulary: { word: string; meaning: string; example: string }[];
  mindmap: {
    centralIdea: string;
    nodes: { title: string; details: string[] }[];
  };
  level: VstepLevel;
}

export interface VstepScore {
  fluency: number;
  grammar: number;
  vocabulary: number;
  pronunciation: number;
  taskResponse: number;
  overall: number;
  feedback: {
    fluency: string;
    grammar: string;
    vocabulary: string;
    pronunciation: string;
    taskResponse: string;
  };
  suggestions: string[];
}

export const generateVstepContent = async (
  topic: string, 
  optionA: string, 
  optionB: string, 
  optionC: string,
  level: VstepLevel
): Promise<VstepContent> => {
  const prompt = `
    Bạn là AI luyện thi VSTEP Speaking chuyên nghiệp.
    Hãy tạo bài nói VSTEP Part 2 (Solution Discussion) cho đề bài sau:
    Topic: ${topic}
    Option A: ${optionA}
    Option B: ${optionB}
    Option C: ${optionC}
    
    TRÌNH ĐỘ YÊU CẦU: ${level}

    QUY TẮC BẮT BUỘC:
    1. Chọn Option A (${optionA}) là Best Choice.
    2. Cấu trúc: Intro (chọn A), Body (2 lý do cho A, bác bỏ B, bác bỏ C), Conclusion.
    3. Ngôn ngữ: Phù hợp trình độ ${level}.
    4. Mindmap: Gợi ý sơ đồ tư duy để phát triển ý tưởng, bao gồm ý chính và các nhánh (lý do chọn A, lý do bỏ B, lý do bỏ C).

    Trả về JSON: {
      topic, 
      sampleAnswer, 
      practiceVersion, 
      translation, 
      vocabulary: [{word, meaning, example}], 
      mindmap: {
        centralIdea: "Tóm tắt ngắn gọn tình huống",
        nodes: [
          { title: "Why choose ${optionA}", details: ["lý do 1", "lý do 2"] },
          { title: "Why NOT ${optionB}", details: ["nhược điểm 1"] },
          { title: "Why NOT ${optionC}", details: ["nhược điểm 1"] }
        ]
      }
    }
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          topic: { type: Type.STRING },
          sampleAnswer: { type: Type.STRING },
          practiceVersion: { type: Type.STRING },
          translation: { type: Type.STRING },
          vocabulary: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING },
                meaning: { type: Type.STRING },
                example: { type: Type.STRING },
              },
              required: ["word", "meaning", "example"],
            },
          },
          mindmap: {
            type: Type.OBJECT,
            properties: {
              centralIdea: { type: Type.STRING },
              nodes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    details: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: ["title", "details"],
                },
              },
            },
            required: ["centralIdea", "nodes"],
          },
        },
        required: ["topic", "sampleAnswer", "practiceVersion", "translation", "vocabulary", "mindmap"],
      },
    },
  });

  const result = JSON.parse(response.text || "{}");
  return { ...result, level };
};

export const generateAudio = async (text: string): Promise<string | undefined> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Read this VSTEP speaking sample clearly and at a moderate pace: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Pcm = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Pcm) return undefined;

    // Convert Base64 PCM to WAV
    const pcmData = Uint8Array.from(atob(base64Pcm), c => c.charCodeAt(0));
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);

    // RIFF identifier
    view.setUint32(0, 0x52494646, false); // "RIFF"
    // file length
    view.setUint32(4, 36 + pcmData.length, true);
    // RIFF type
    view.setUint32(8, 0x57415645, false); // "WAVE"
    // format chunk identifier
    view.setUint32(12, 0x666d7420, false); // "fmt "
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (raw)
    view.setUint16(20, 1, true);
    // channel count
    view.setUint16(22, 1, true);
    // sample rate
    view.setUint32(24, 24000, true);
    // byte rate (sample rate * block align)
    view.setUint32(28, 24000 * 2, true);
    // block align (channel count * bytes per sample)
    view.setUint16(32, 2, true);
    // bits per sample
    view.setUint16(34, 16, true);
    // data chunk identifier
    view.setUint32(36, 0x64617461, false); // "data"
    // data chunk length
    view.setUint32(40, pcmData.length, true);

    const wavBlob = new Blob([wavHeader, pcmData], { type: 'audio/wav' });
    return URL.createObjectURL(wavBlob);
  } catch (error) {
    console.error("Error generating audio:", error);
    return undefined;
  }
};

export const scoreSpeech = async (originalText: string, transcribedText: string): Promise<VstepScore> => {
  const prompt = `
    Bạn là giám khảo VSTEP Speaking.
    Hãy chấm điểm bài nói của thí sinh dựa trên bài mẫu.
    
    Bài mẫu: ${originalText}
    Bài nói của thí sinh (transcribed): ${transcribedText}

    Tiêu chí chấm điểm (thang điểm 10):
    1. Fluency (độ trôi chảy)
    2. Grammar (ngữ pháp)
    3. Vocabulary (từ vựng)
    4. Pronunciation (phát âm - dựa trên transcript và lỗi chính tả/ngữ pháp suy ra)
    5. Task response (trả lời đúng đề)

    Trả về kết quả dưới dạng JSON bao gồm điểm số, feedback chi tiết cho từng tiêu chí và gợi ý cải thiện.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          fluency: { type: Type.NUMBER },
          grammar: { type: Type.NUMBER },
          vocabulary: { type: Type.NUMBER },
          pronunciation: { type: Type.NUMBER },
          taskResponse: { type: Type.NUMBER },
          overall: { type: Type.NUMBER },
          feedback: {
            type: Type.OBJECT,
            properties: {
              fluency: { type: Type.STRING },
              grammar: { type: Type.STRING },
              vocabulary: { type: Type.STRING },
              pronunciation: { type: Type.STRING },
              taskResponse: { type: Type.STRING },
            },
          },
          suggestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ["fluency", "grammar", "vocabulary", "pronunciation", "taskResponse", "overall", "feedback", "suggestions"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
};
