<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>💚💗⎯⎯❥ AAHAN BOT PANEL ❥⎯⎯💗💚</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');

    :root {
      --green-primary: #00ff66;
      --green-border: #00aa33;
      --dark-bg: #ffffff;
    }

    html, body {
      height: 100%;
      margin: 0;
      padding: 0;
      font-family: 'Poppins', sans-serif;
    }

    body {
      min-height: 100%;
      background: 
        linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)),
        url('https://vicious-plum-lzpu5zdjmm.edgeone.app/IMG_1382.jpeg');
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      color: #fff;
      overflow: hidden;
    }

    .panel {
      position: relative;
      width: 100%;
      max-width: 400px;
      border-radius: 15px;
      padding: 20px;
      background: transparent; /* पूरी तरह पारदर्शी */
      border: 2px solid var(--green-border);
      box-shadow: 0 0 20px rgba(0, 170, 51, 0.5);
      backdrop-filter: blur(10px); /* बैकग्राउंड ब्लर इफेक्ट */
      box-sizing: border-box;
      animation: fadeIn 1.5s ease-in-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(40px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .title {
      text-align: center;
      font-size: clamp(1.5rem, 4vw, 2rem);
      font-weight: 700;
      margin: 0 0 15px;
      color: var(--green-primary);
      text-shadow: 0 0 10px var(--green-primary), 0 0 20px var(--green-border);
      animation: glowText 2s infinite alternate;
    }

    @keyframes glowText {
      from { text-shadow: 0 0 10px var(--green-primary); }
      to { text-shadow: 0 0 25px var(--green-primary); }
    }

    form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    label {
      font-weight: 600;
      color: #aaffaa;
      margin-bottom: 4px;
      display: block;
    }

    textarea, input[type="text"] {
      width: 100%;
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid var(--green-border);
      background: rgba(0, 30, 0, 0.7);
      color: #fff;
      font-size: 0.9rem;
      box-sizing: border-box;
      resize: vertical;
      transition: all 0.3s ease;
      box-shadow: 0 0 10px rgba(0, 255, 100, 0.15);
    }

    textarea {
      min-height: 80px;
    }

    textarea:focus, input:focus {
      outline: none;
      border: 1px solid var(--green-primary);
      background: rgba(0, 50, 0, 0.8);
      box-shadow: 0 0 20px var(--green-primary);
    }

    button {
      margin-top: 8px;
      background: linear-gradient(90deg, #005500, #00aa33);
      border: 1px solid var(--green-border);
      padding: 10px 16px;
      border-radius: 20px;
      font-weight: 700;
      font-size: 0.9rem;
      color: #fff;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 0 10px rgba(0, 170, 51, 0.3);
      width: 100%;
      letter-spacing: 0.5px;
    }

    button:hover {
      transform: scale(1.03);
      background: linear-gradient(90deg, #00aa33, #00ff66);
      box-shadow: 0 0 15px rgba(0, 255, 102, 0.4);
    }

    /* 🔥 Dark Green Animated Box */
    .green-box {
      margin-top: 15px;
      text-align: center;
      padding: 10px 8px;
      border: 1px solid var(--green-border);
      border-radius: 10px;
      background: rgba(0, 40, 0, 0.3); /* हल्का पारदर्शी */
      color: var(--green-primary);
      font-weight: 700;
      font-size: 0.85rem;
      text-shadow: 0 0 5px rgba(0, 255, 102, 0.5);
      box-shadow: 0 0 10px rgba(0, 170, 51, 0.3);
      letter-spacing: 0.5px;
      animation: greenGlow 2s infinite alternate ease-in-out;
      backdrop-filter: blur(5px);
    }

    @keyframes greenGlow {
      from { box-shadow: 0 0 5px rgba(0, 170, 51, 0.3), 0 0 10px rgba(0, 255, 102, 0.4); }
      to { box-shadow: 0 0 15px rgba(0, 255, 102, 0.5), 0 0 25px rgba(0, 170, 51, 0.4); }
    }

    .particle {
      position: absolute;
      border-radius: 50%;
      background: var(--green-primary);
      opacity: 0.3;
      animation: floatUp 10s linear infinite;
    }

    @keyframes floatUp {
      0% { transform: translateY(0) scale(1); opacity: 0.2; }
      50% { opacity: 0.5; }
      100% { transform: translateY(-100vh) scale(0.7); opacity: 0; }
    }
  </style>
</head>
<body>
  <div id="particles"></div>

  <div class="panel">
    <h1 class="title">💗⎯⎯❥ AAHAN BOT PANEL ❥⎯⎯💗</h1>

    <form id="configForm">
      <div>
        <label for="cookies">𝑭𝑨𝑪𝑬𝑩𝑶𝑶𝑲 𝑨𝑷𝑷𝑺𝑻𝑨𝑻𝑬</label>
        <textarea id="cookies" name="cookies" required placeholder="𝑭𝑨𝑪𝑬𝑩𝑶𝑶𝑲 𝑨𝑷𝑷𝑺𝑻𝑨𝑻𝑬 𝑫𝑨𝑳𝑶 𝑬𝑺 𝑴𝑬"></textarea>
      </div>

      <div>
        <label for="prefix">𝑩𝑶𝑻 𝑷𝑹𝑬𝑭𝑰𝑿 ("/")</label>
        <input type="text" id="prefix" name="prefix" value="/" required>
      </div>

      <div>
        <label for="adminID">𝑨𝑫𝑴𝑰𝑵 𝑭𝑩 𝑼𝑰𝑫</label>
        <input type="text" id="adminID" name="adminID" required placeholder="𝐅𝐁 𝐀𝐃𝐌𝐈𝐍 𝐔𝐈𝐃 𝐃𝐀𝐋 𝐄𝐒 𝐌𝐄">
      </div>

      <button type="submit">Start Bot 🌿</button>
    </form>

    <!-- 💚 Dark Green Animated Box -->
    <div class="green-box">
      💚𝐓𝐇𝐄'𝐖 𝐓𝐇𝐄 𝐔𝐍𝐒𝐓𝐎𝐏𝐏𝐀𝐁𝐋𝐄 𝐋𝐄𝐆𝐄𝐍𝐃 𝐁𝐎𝐘 💗⎯⎯❥ AAHAN H3R3  ❥⎯⎯💗💚
    </div>
  </div>

  <script>
    (function createParticles() {
      const container = document.getElementById('particles');
      const count = 20;
      for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        const size = Math.random() * 4 + 3;
        p.style.width = size + 'px';
        p.style.height = size + 'px';
        p.style.left = Math.random() * 100 + 'vw';
        p.style.top = Math.random() * 100 + 'vh';
        p.style.animationDuration = 8 + Math.random() * 6 + 's';
        p.style.animationDelay = Math.random() * 4 + 's';
        container.appendChild(p);
      }
    })();

    document.getElementById('configForm').addEventListener('submit', function(e) {
      e.preventDefault();
      const data = new FormData(e.target);

      fetch('/configure', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams(data)
      })
      .then(res => res.text())
      .then(msg => alert(msg || '✅ Bot configured successfully.'))
      .catch(() => {
        const preview = {
          cookies: data.get('cookies'),
          prefix: data.get('prefix'),
          adminID: data.get('adminID')
        };
        alert('🟢 No server found. Config Preview:\n\n' + JSON.stringify(preview, null, 2));
      });
    });
  </script>
</body>
</html>
