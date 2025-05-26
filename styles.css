/* style.css */

/* Import a clean sans font and a monospace for code/note display */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Roboto+Mono&display=swap');

/* Full-screen animated gradient background */
body {
  margin: 0;
  min-height: 100vh;
  background: linear-gradient(-45deg, #ff6b6b, #f8e71c, #6bffb8, #6b6bff);
  background-size: 400% 400%;
  animation: gradientShift 15s ease infinite;
  font-family: 'Inter', sans-serif;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

/* Gradient animation */
@keyframes gradientShift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

/* Shared panel style for all views */
#createView,
#shareView,
#passwordModal,
#noteView {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(12px);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  padding: 2rem;
  width: 100%;
  max-width: 480px;
  margin: auto;
  animation: fadeIn 0.6s ease both;
}

/* Fade-in helper */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to   { opacity: 1; transform: translateY(0);       }
}

/* Inputs and textareas */
textarea,
input,
select {
  width: 100%;
  padding: 0.8rem;
  margin-bottom: 1rem;
  border: none;
  border-radius: 8px;
  background: rgba(255,255,255,0.2);
  color: #fff;
  font-size: 1rem;
  font-family: 'Inter', sans-serif;
  box-sizing: border-box;
  transition: background 0.2s ease;
}
textarea:focus,
input:focus,
select:focus {
  background: rgba(255,255,255,0.3);
  outline: none;
}

/* Buttons */
button {
  display: inline-block;
  padding: 0.8rem 1.6rem;
  margin: 0.3rem 0.2rem;
  font-size: 1rem;
  font-weight: 500;
  color: #222;
  background: linear-gradient(135deg, #ffd54f, #ff6e40);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
button:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.3);
}

/* Read-only share link */
#shareLink {
  font-family: 'Roboto Mono', monospace;
  background: rgba(255,255,255,0.2);
  border-radius: 8px;
  padding: 0.6rem;
  margin-bottom: 1rem;
  resize: none;
  height: 4rem;
  color: #fff;
}

/* Countdown timers */
#countdown,
#viewCountdown {
  text-align: center;
  font-size: 1.2rem;
  margin-top: 1rem;
  font-weight: 500;
}

/* Note display area */
#noteDisplay {
  font-family: 'Roboto Mono', monospace;
  white-space: pre-wrap;
  line-height: 1.5;
  font-size: 1rem;
}

/* Utility */
.hidden { display: none; }
