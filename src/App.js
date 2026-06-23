import { useState, useEffect } from "react";
import { wordsByLevel, levels } from "./data/words";
import { sentencesByLevel } from "./data/sentences";
import "./App.css";

// TTS - 일본어 읽어주기
function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "ja-JP";
  utter.rate = 0.85;
  window.speechSynthesis.speak(utter);
}

function getTodayIndex(total, offset = 0) {
  const today = new Date();
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
  return (dayOfYear + offset) % total;
}

function getStreakData() {
  try {
    const stored = localStorage.getItem("jlpt_streak");
    if (!stored) return { streak: 0, lastDate: null };
    return JSON.parse(stored);
  } catch { return { streak: 0, lastDate: null }; }
}

function updateStreak() {
  const today = new Date().toDateString();
  const data = getStreakData();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (data.lastDate === today) return data.streak;
  let newStreak = data.lastDate === yesterday ? data.streak + 1 : 1;
  localStorage.setItem("jlpt_streak", JSON.stringify({ streak: newStreak, lastDate: today }));
  return newStreak;
}

// 온보딩 화면
function Onboarding({ onSelect }) {
  return (
    <div className="onboarding">
      <div className="onboarding-logo">日</div>
      <h1 className="onboarding-title">일일일본어</h1>
      <p className="onboarding-desc">매일 하나씩, 꾸준히</p>
      <p className="onboarding-sub">레벨을 선택해주세요</p>
      <div className="onboarding-levels">
        {levels.map((level) => (
          <button key={level} className="onboarding-level-btn" onClick={() => onSelect(level)}>
            <span className="ol-level">{level}</span>
            <span className="ol-desc">{
              level === "N5" ? "기초 / 왕초보" :
              level === "N4" ? "초급 / 기초 문법" :
              level === "N3" ? "중급 / 일상 회화" :
              level === "N2" ? "중상급 / 비즈니스" :
              "고급 / 원어민 수준"
            }</span>
            <span className="ol-words">{wordsByLevel[level].length}단어</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// 문장 카드
function SentenceCard({ sentence, index }) {
  const [show, setShow] = useState(false);
  return (
    <div className="sentence-card">
      <span className="sentence-num">{index + 1}</span>
      <div className="sentence-content" onClick={() => setShow(!show)}>
        <p className="sentence-jp">{sentence.jp}</p>
        {show && <p className="sentence-ko">{sentence.ko}</p>}
        {!show && <p className="sentence-tap">탭해서 해석 보기</p>}
      </div>
      <button className="tts-btn" onClick={(e) => { e.stopPropagation(); speak(sentence.jp); }}>🔊</button>
    </div>
  );
}

export default function App() {
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [notifTime, setNotifTime] = useState(() => localStorage.getItem("jlpt_notif_time") || "09:00");
  const [streak, setStreak] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [todayChecked, setTodayChecked] = useState(() =>
    localStorage.getItem("jlpt_checked") === new Date().toDateString()
  );

  // 첫 실행 시 저장된 레벨 불러오기
  useEffect(() => {
    const saved = localStorage.getItem("jlpt_level");
    if (saved) setSelectedLevel(saved);
    setStreak(getStreakData().streak);
  }, []);

  const handleLevelSelect = (level) => {
    setSelectedLevel(level);
    localStorage.setItem("jlpt_level", level);
    setShowAnswer(false);
    setShowSettings(false);
  };

  // 레벨 미선택 시 온보딩
  if (!selectedLevel) return <Onboarding onSelect={handleLevelSelect} />;

  const words = wordsByLevel[selectedLevel];
  const todayWord = words[getTodayIndex(words.length)];

  const sentences = sentencesByLevel[selectedLevel];
  // 문장 3개: 첫번째는 오늘 단어 예문, 나머지 2개는 랜덤
  const todaySentences = [
    { jp: todayWord.example, ko: todayWord.exampleKo },
    sentences[getTodayIndex(sentences.length, 1)],
    sentences[getTodayIndex(sentences.length, 7)],
  ];

  const handleCheck = () => {
    setStreak(updateStreak());
    setTodayChecked(true);
    localStorage.setItem("jlpt_checked", new Date().toDateString());
  };

  const requestNotification = async () => {
    if (!("Notification" in window)) { alert("이 브라우저는 알림을 지원하지 않습니다."); return; }
    const permission = await Notification.requestPermission();
    setNotifPermission(permission);
    if (permission === "granted") sendTestNotif();
  };

  const sendTestNotif = async () => {
    if (Notification.permission !== "granted") {
      await requestNotification();
      return;
    }
    try {
      // Service Worker 통해서 알림 보내기 (PWA 앱에서 작동)
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(`🇯🇵 오늘의 ${selectedLevel} 단어`, {
          body: `${todayWord.word}（${todayWord.reading}）— ${todayWord.meaning}`,
          icon: "/logo192.png",
          badge: "/logo192.png",
          vibrate: [200, 100, 200],
        });
      } else {
        // SW 없으면 일반 방식으로 fallback
        new Notification(`🇯🇵 오늘의 ${selectedLevel} 단어`, {
          body: `${todayWord.word}（${todayWord.reading}）— ${todayWord.meaning}`,
          icon: "/logo192.png",
        });
      }
    } catch (e) {
      // 마지막 fallback
      new Notification(`🇯🇵 오늘의 ${selectedLevel} 단어`, {
        body: `${todayWord.word}（${todayWord.reading}）— ${todayWord.meaning}`,
      });
    }
  };

  const todayDate = new Date().toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "long"
  });

  return (
    <div className="app">
      {/* 헤더 */}
      <header className="header">
        <div className="header-left">
          <span className="app-logo">日</span>
          <div>
            <h1 className="app-title">일일일본어</h1>
            <p className="app-subtitle">매일 하나씩</p>
          </div>
        </div>
        <div className="header-right">
          <div className="streak-badge">
            <span className="streak-fire">🔥</span>
            <span className="streak-count">{streak}</span>
          </div>
          <button className="settings-btn" onClick={() => setShowSettings(!showSettings)}>⚙️</button>
        </div>
      </header>

      {/* 설정 패널 */}
      {showSettings && (
        <div className="settings-panel">
          <h3>설정</h3>

          {/* 레벨 변경 */}
          <div className="setting-section">
            <label className="setting-label">레벨 변경</label>
            <div className="level-selector">
              {levels.map((level) => (
                <button
                  key={level}
                  className={`level-btn ${selectedLevel === level ? "active" : ""}`}
                  onClick={() => handleLevelSelect(level)}
                >{level}</button>
              ))}
            </div>
          </div>

          {/* 알림 시간 */}
          <div className="setting-row">
            <label>알림 시간</label>
            <div className="notif-row">
              <input type="time" value={notifTime}
                onChange={(e) => setNotifTime(e.target.value)}
                className="time-input" />
              <button className="btn-small" onClick={() => {
                localStorage.setItem("jlpt_notif_time", notifTime);
                alert(`${notifTime}으로 설정되었습니다.`);
              }}>저장</button>
            </div>
          </div>

          {/* 알림 권한 */}
          <div className="setting-row">
            <label>알림 권한</label>
            {notifPermission === "granted" ? (
              <div className="notif-status granted">
                <span>✅ 허용됨</span>
              </div>
            ) : (
              <button className="btn-small" onClick={requestNotification}>허용하기</button>
            )}
          </div>

          {/* 알림 테스트 */}
          <div className="setting-row">
            <label>알림 테스트</label>
            <button className="btn-small btn-test" onClick={
              notifPermission === "granted" ? sendTestNotif : requestNotification
            }>🔔 지금 알림 보내기</button>
          </div>
        </div>
      )}

      <p className="today-date">{todayDate} · {selectedLevel}</p>

      {/* 오늘의 단어 */}
      <div className="section-label">오늘의 단어</div>
      <div className="card" onClick={() => setShowAnswer(!showAnswer)}>
        <div className="word-number">{getTodayIndex(words.length) + 1} / {words.length}</div>
        <div className="word-main">
          <span className="word-kanji">{todayWord.word}</span>
          <span className="word-reading">（{todayWord.reading}）</span>
        </div>
        <div className={`word-answer ${showAnswer ? "visible" : ""}`}>
          <div className="word-meaning">{todayWord.meaning}</div>
        </div>
        {!showAnswer && <p className="tap-hint">탭해서 뜻 보기</p>}
        <button className="tts-btn-word" onClick={(e) => { e.stopPropagation(); speak(todayWord.word); }}>🔊 발음 듣기</button>
      </div>

      {/* 오늘의 문장 */}
      <div className="section-label">오늘의 문장</div>
      <div className="sentences-list">
        {todaySentences.map((s, i) => (
          <SentenceCard key={i} sentence={s} index={i} />
        ))}
      </div>

      {/* 학습 완료 버튼 */}
      <button className={`check-btn ${todayChecked ? "checked" : ""}`}
        onClick={handleCheck} disabled={todayChecked}>
        {todayChecked ? "✅ 오늘 학습 완료!" : "오늘 학습 완료"}
      </button>

      {/* 진행도 */}
      <div className="progress-section">
        <div className="progress-header">
          <span>{selectedLevel} 진행도</span>
          <span>{getTodayIndex(words.length) + 1} / {words.length}</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill"
            style={{ width: `${((getTodayIndex(words.length) + 1) / words.length) * 100}%` }} />
        </div>
      </div>

      {notifPermission !== "granted" && (
        <div className="notif-banner" onClick={requestNotification}>
          🔔 매일 알림을 받으려면 탭하세요
        </div>
      )}
    </div>
  );
}
