import { useState, useEffect, useRef } from "react";
import type { Domain, Mode } from "../api/types";
import { DOMAIN_LABEL } from "../api/types";

// Hàm làm sạch văn bản markdown/ký hiệu trích dẫn trước khi phát âm tiếng Việt
function cleanTextForSpeech(text: string): string {
  return text
    .replace(/\[E\d+\]/g, "") // Bỏ [E1], [E2]...
    .replace(/\[#conv-[^\]]+\]/g, "")
    .replace(/#{1,6}\s+/g, "") // Bỏ tiêu đề markdown
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1") // Bỏ bold/italic
    .replace(/`{1,3}[^`]+`{1,3}/g, "") // Bỏ code blocks
    .replace(/https?:\/\/\S+/g, "") // Bỏ URL
    .replace(/\n+/g, ". ") // Thay xuống dòng bằng dấu chấm ngắt câu
    .trim();
}

export function VoiceModeOverlay({
  isOpen,
  onClose,
  domain,
  mode,
  onAskQuestion,
  onShowToast,
}: {
  isOpen: boolean;
  onClose: () => void;
  domain: Domain;
  mode: Mode;
  onAskQuestion: (question: string) => Promise<string>;
  onShowToast?: (msg: string) => void;
}) {
  const [isMuted, setIsMuted] = useState(false);
  const [speakingPhase, setSpeakingPhase] = useState<"listening" | "thinking" | "speaking" | "error">("listening");
  const [transcript, setTranscript] = useState("");
  const [lastAnswer, setLastAnswer] = useState("");
  const [voiceName, setVoiceName] = useState("Tiếng Việt (Tự nhiên)");

  const speakingPhaseRef = useRef<"listening" | "thinking" | "speaking" | "error">("listening");
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const isComponentMounted = useRef(true);

  const changePhase = (phase: "listening" | "thinking" | "speaking" | "error") => {
    speakingPhaseRef.current = phase;
    setSpeakingPhase(phase);
  };

  // Nạp danh sách giọng đọc tiếng Việt khi sẵn sàng
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const updateVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        const viVoice = voices.find((v) => v.lang === "vi-VN" || v.lang.startsWith("vi"));
        if (viVoice) {
          setVoiceName(viVoice.name.replace(/Google|Microsoft/g, "").trim() || "Tiếng Việt");
        }
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  // Dừng mọi âm thanh và bộ nhận diện khi đóng modal
  const stopAll = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  // Khởi tạo Text-to-Speech phát âm câu trả lời
  const speakAnswer = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      changePhase("listening");
      startListening();
      return;
    }

    window.speechSynthesis.cancel();
    const clean = cleanTextForSpeech(text);
    if (!clean) {
      changePhase("listening");
      startListening();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = "vi-VN";
    utterance.rate = 1.05; // Tốc độ tự nhiên
    utterance.pitch = 1.0;

    // Tìm giọng đọc tiếng Việt của hệ thống nếu có
    const voices = window.speechSynthesis.getVoices();
    const viVoice = voices.find((v) => v.lang === "vi-VN" || v.lang.startsWith("vi"));
    if (viVoice) {
      utterance.voice = viVoice;
      setVoiceName(viVoice.name.replace(/Google|Microsoft/g, "").trim() || "Tiếng Việt");
    }

    utterance.onstart = () => {
      changePhase("speaking");
    };

    utterance.onend = () => {
      if (isComponentMounted.current) {
        changePhase("listening");
        startListening();
      }
    };

    utterance.onerror = () => {
      if (isComponentMounted.current) {
        changePhase("listening");
        startListening();
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  // Gửi câu hỏi nhận diện được vào Videcomp-rag
  const handleProcessQuery = async (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed) {
      changePhase("listening");
      startListening();
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    changePhase("thinking");
    try {
      const answer = await onAskQuestion(trimmed);
      setLastAnswer(answer);
      speakAnswer(answer);
    } catch (err: any) {
      changePhase("error");
      onShowToast?.("Không thể hoàn tất trả lời: " + (err.message || "Lỗi mạng"));
      setTimeout(() => {
        changePhase("listening");
        startListening();
      }, 2500);
    }
  };

  // Khởi động lắng nghe giọng nói Web Speech API
  const startListening = () => {
    if (isMuted) return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      onShowToast?.("Trình duyệt không hỗ trợ Web Speech API. Bạn có thể chọn câu hỏi mẫu bên dưới.");
      return;
    }

    stopAll();

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "vi-VN";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        changePhase("listening");
      };

      recognition.onresult = (event: any) => {
        let currentInterim = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            currentInterim += event.results[i][0].transcript;
          }
        }

        const fullText = (finalTranscript + " " + currentInterim).trim();
        if (fullText) {
          setTranscript(fullText);

          // Phát hiện khoảng lặng: Nếu người dùng ngừng nói sau 1.8 giây, tự động gửi câu hỏi
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            handleProcessQuery(fullText);
          }, 1800);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === "no-speech") {
          return;
        }
        if (event.error === "not-allowed") {
          onShowToast?.("Vui lòng cấp quyền Micro trên trình duyệt hoặc thử các câu hỏi mẫu bên dưới.");
          setIsMuted(true);
        }
      };

      recognition.onend = () => {
        // Tự động duy trì nếu vẫn đang ở trạng thái lắng nghe và không mute
        if (speakingPhaseRef.current === "listening" && !isMuted && isComponentMounted.current) {
          try {
            recognition.start();
          } catch {}
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.warn("Không thể khởi động Web Speech API:", e);
    }
  };

  useEffect(() => {
    isComponentMounted.current = true;
    if (isOpen) {
      setTranscript("");
      setLastAnswer("");
      changePhase("listening");
      startListening();
    } else {
      stopAll();
    }
    return () => {
      isComponentMounted.current = false;
      stopAll();
    };
  }, [isOpen, isMuted]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#131313] flex flex-col justify-between p-unit-lg animate-in fade-in duration-300 select-none">
      {/* Header đỉnh */}
      <div className="flex items-center justify-between w-full max-w-6xl mx-auto">
        <div className="flex items-center gap-2 px-unit-sm py-1.5 rounded-full bg-surface-container-high/80 border border-outline-variant/30 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-label-sm text-on-surface font-medium">
            Videcomp-rag Voice • {DOMAIN_LABEL[domain]}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-unit-sm py-1 rounded-full bg-surface-container-high border border-outline-variant/30 text-label-sm text-on-surface">
            <span className="material-symbols-outlined text-[16px] text-primary">record_voice_over</span>
            <span>{voiceName}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              stopAll();
              onClose();
            }}
            className="w-9 h-9 rounded-full bg-surface-container-high hover:bg-surface-container-highest text-on-surface flex items-center justify-center transition-colors"
            title="Đóng chế độ giọng nói"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
      </div>

      {/* Vùng phát sáng & Khối cầu hữu cơ trung tâm */}
      <div className="flex-1 flex flex-col items-center justify-center relative my-auto">
        {/* Hào quang nền */}
        <div
          className={`absolute w-[460px] h-[460px] rounded-full blur-[140px] pointer-events-none transition-all duration-700 ${
            speakingPhase === "speaking"
              ? "bg-primary/25 scale-125"
              : speakingPhase === "thinking"
              ? "bg-primary-container/20 scale-100"
              : "bg-primary/15 scale-90"
          }`}
        />

        {/* Khối cầu hữu cơ chuyển động theo pha */}
        <div className="relative flex items-center justify-center">
          <div
            className="w-52 h-52 sm:w-64 sm:h-64 rounded-full transition-transform duration-700 ease-out shadow-2xl flex items-center justify-center relative overflow-hidden"
            style={{
              background:
                speakingPhase === "speaking"
                  ? "radial-gradient(circle at 35% 35%, #7ff8cf 0%, #61dbb4 40%, #12a480 80%, #00382a 100%)"
                  : speakingPhase === "thinking"
                  ? "radial-gradient(circle at 35% 35%, #61dbb4 0%, #12a480 50%, #006c52 100%)"
                  : "radial-gradient(circle at 35% 35%, #61dbb4 0%, #12a480 70%, #1b1c1c 100%)",
              boxShadow:
                speakingPhase === "speaking"
                  ? "0 0 70px rgba(97, 219, 180, 0.6)"
                  : "0 0 45px rgba(97, 219, 180, 0.35)",
              animation:
                speakingPhase === "speaking"
                  ? "blobSpeaking 2.5s ease-in-out infinite alternate"
                  : speakingPhase === "thinking"
                  ? "blobSpin 3s linear infinite"
                  : "blobListening 6s ease-in-out infinite alternate",
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent pointer-events-none" />
          </div>
        </div>

        {/* Trạng thái văn bản & Lời thoại nhận diện */}
        <div className="text-center mt-unit-2xl space-y-2 max-w-2xl px-4 z-10">
          <div className="inline-flex items-center gap-1.5 text-label-sm uppercase tracking-widest font-semibold text-primary">
            <span
              className={`w-2 h-2 rounded-full ${
                speakingPhase === "speaking"
                  ? "bg-primary animate-ping"
                  : speakingPhase === "thinking"
                  ? "bg-[#ffbd2e] animate-pulse"
                  : "bg-primary"
              }`}
            />
            {speakingPhase === "listening"
              ? isMuted
                ? "MICRO ĐANG TẮT"
                : "ĐANG LẮNG NGHE..."
              : speakingPhase === "thinking"
              ? "VIDECOMP-RAG ĐANG SUY LUẬN & TRUY HỒI..."
              : speakingPhase === "speaking"
              ? "VIDECOMP-RAG ĐANG TRẢ LỜI..."
              : "LỖI KẾT NỐI"}
          </div>

          {/* Hiển thị câu nói của người dùng theo thời gian thực */}
          {transcript ? (
            <p className="font-headline-md text-headline-md font-medium text-on-surface leading-relaxed transition-all">
              &ldquo;{transcript}&rdquo;
            </p>
          ) : (
            <p className="font-headline-md text-headline-md font-medium text-outline italic leading-relaxed">
              &ldquo;Hãy nói vào micro để đặt câu hỏi pháp luật hoặc y tế...&rdquo;
            </p>
          )}

          {/* Hiển thị đoạn tóm tắt câu trả lời khi đang phát âm */}
          {speakingPhase === "speaking" && lastAnswer && (
            <div className="p-unit-sm rounded-xl bg-surface-container/60 border border-primary/20 text-body-sm text-on-surface-variant max-h-28 overflow-y-auto mt-2">
              {lastAnswer}
            </div>
          )}

          <p className="font-body-sm text-[13px] text-outline pt-1">
            Nhận diện tiếng Việt chuẩn Web Speech API • Tự động gửi sau 1.8s ngắt quãng
          </p>

          {speakingPhase === "listening" && !transcript && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <span className="text-[12px] text-outline">Thử giọng nói mẫu:</span>
              {[
                domain === "legal"
                  ? "Thời giờ làm việc bình thường theo quy định luật lao động?"
                  : "Dấu hiệu và phác đồ điều trị sốt xuất huyết Dengue?",
                domain === "legal"
                  ? "Cách tính tiền trợ cấp thôi việc cho người lao động?"
                  : "Chỉ số đường huyết bao nhiêu thì được coi là đái tháo đường?",
              ].map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setTranscript(sample);
                    handleProcessQuery(sample);
                  }}
                  className="px-3 py-1 rounded-full bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-[12px] text-on-surface hover:text-primary transition-all flex items-center gap-1.5"
                  title="Nhấp để thử thoại câu này"
                >
                  <span className="material-symbols-outlined text-[14px] text-primary">play_arrow</span>
                  <span>{sample}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dưới cùng: Visualizer & Thanh công cụ điều khiển */}
      <div className="flex flex-col items-center gap-unit-md w-full max-w-xl mx-auto pb-unit-md">
        {/* Animated Waveform Visualizer */}
        <div className="flex items-center justify-center gap-1.5 h-7">
          {[14, 24, 12, 28, 18, 30, 16, 26, 14, 22, 10, 20].map((h, i) => (
            <div
              key={i}
              className="w-1 bg-primary rounded-full transition-all duration-150"
              style={{
                height:
                  isMuted || speakingPhase === "thinking"
                    ? 4
                    : `${Math.max(4, h + (speakingPhase === "speaking" ? 8 : 0))}px`,
                animation:
                  isMuted || speakingPhase === "thinking"
                    ? "none"
                    : `waveBar 0.7s ease-in-out infinite alternate ${i * 0.07}s`,
              }}
            />
          ))}
        </div>

        {/* Thanh nút điều khiển */}
        <div className="flex items-center gap-unit-sm p-unit-xs rounded-full bg-surface-container border border-outline-variant/30 shadow-2xl backdrop-blur-xl">
          {/* Nút gửi ngay nếu đã nói xong */}
          {transcript && speakingPhase === "listening" && (
            <button
              type="button"
              onClick={() => handleProcessQuery(transcript)}
              className="px-unit-md py-2 rounded-full bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 text-label-sm font-semibold transition-colors flex items-center gap-1"
              title="Gửi câu hỏi ngay"
            >
              <span>Hỏi ngay</span>
              <span className="material-symbols-outlined text-[16px]">send</span>
            </button>
          )}

          {/* Nút Mic Bật/Tắt */}
          <button
            type="button"
            onClick={() => {
              const nextMuted = !isMuted;
              setIsMuted(nextMuted);
              if (nextMuted) {
                stopAll();
                setSpeakingPhase("listening");
              } else {
                startListening();
              }
              onShowToast?.(nextMuted ? "Đã tắt Micro" : "Đã bật Micro và đang lắng nghe");
            }}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${
              isMuted
                ? "bg-error text-white"
                : "bg-on-surface text-surface hover:opacity-90 active:scale-95"
            }`}
            title={isMuted ? "Bật micro" : "Tắt micro"}
          >
            <span className="material-symbols-outlined text-[24px]">
              {isMuted ? "mic_off" : "mic"}
            </span>
          </button>

          {/* Nút chuyển về bàn phím */}
          <button
            type="button"
            onClick={() => {
              stopAll();
              onClose();
            }}
            className="w-11 h-11 rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors"
            title="Chuyển sang gõ chữ"
          >
            <span className="material-symbols-outlined text-[22px]">keyboard</span>
          </button>

          {/* Nút ngắt kết thúc thoại */}
          <button
            type="button"
            onClick={() => {
              stopAll();
              onClose();
            }}
            className="w-11 h-11 rounded-full bg-error text-white hover:opacity-90 active:scale-95 flex items-center justify-center transition-all shadow-md"
            title="Dừng cuộc gọi"
          >
            <span className="material-symbols-outlined text-[22px]">call_end</span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes blobListening {
          0% {
            border-radius: 48% 52% 60% 40% / 45% 55% 45% 55%;
            transform: scale(1) rotate(0deg);
          }
          50% {
            border-radius: 60% 40% 45% 55% / 55% 45% 55% 45%;
            transform: scale(1.05) rotate(180deg);
          }
          100% {
            border-radius: 45% 55% 50% 50% / 50% 50% 55% 45%;
            transform: scale(0.97) rotate(360deg);
          }
        }
        @keyframes blobSpeaking {
          0% {
            border-radius: 45% 55% 40% 60% / 55% 45% 60% 40%;
            transform: scale(1.02);
          }
          50% {
            border-radius: 65% 35% 60% 40% / 40% 60% 35% 65%;
            transform: scale(1.15);
          }
          100% {
            border-radius: 40% 60% 50% 50% / 60% 40% 50% 50%;
            transform: scale(1.05);
          }
        }
        @keyframes blobSpin {
          from { transform: rotate(0deg) scale(0.95); }
          to { transform: rotate(360deg) scale(0.95); }
        }
        @keyframes waveBar {
          from { transform: scaleY(0.3); }
          to { transform: scaleY(1.3); }
        }
      `}</style>
    </div>
  );
}
