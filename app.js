let words = []
let shuffledWords = []
let currentIndex = 0
let showAnswer = false

// 页面加载时读取本地缓存
window.onload = () => {
  loadWordsFromCache()
  // 默认进入搜索模式并显示列表
  switchMode('search')
}

function loadWordsFromCache() {
  const saved = localStorage.getItem("words")
  if (saved) {
    try {
      words = JSON.parse(saved)
      console.log("Loaded words from cache:", words.length)
      if (words.length > 0) {
        doSearch() // 初始显示所有单词
      }
    } catch (e) {
      console.error("Failed to parse cached words", e)
      words = []
    }
  }
}

// 切换模式
function switchMode(mode) {
  const searchMode = document.getElementById("search-mode")
  const flashcardMode = document.getElementById("flashcard-mode")
  const searchTab = document.getElementById("searchTab")
  const flashcardTab = document.getElementById("flashcardTab")

  if (mode === 'search') {
    searchMode.style.display = "block"
    flashcardMode.style.display = "none"
    searchTab.classList.add("active")
    flashcardTab.classList.remove("active")
    doSearch()
  } else {
    searchMode.style.display = "none"
    flashcardMode.style.display = "flex"
    searchTab.classList.remove("active")
    flashcardTab.classList.add("active")
    updateFlashcardHeader()
  }
}

// 导入 CSV
function importCSV() {
  const file = document.getElementById("csvFile").files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = function (e) {
    const text = e.target.result
    const lines = text.split("\n").filter(line => line.trim())

    const newWords = lines.map(line => {
      const parts = line.split(",")
      return {
        hiragana: parts[0]?.trim() || "",
        katakana: parts[1]?.trim() || "",
        chinese: parts[2]?.trim() || "",
        reading: parts[3]?.trim() || ""
      }
    }).filter(w => w.hiragana || w.chinese)

    if (newWords.length > 0) {
      words = newWords
      localStorage.setItem("words", JSON.stringify(words))
      alert(`导入成功，共 ${words.length} 条单词`)
      doSearch()
      updateFlashcardHeader()
    } else {
      alert("导入失败，请检查 CSV 格式")
    }
  }

  reader.readAsText(file, "utf-8")
}

// 搜索
function doSearch() {
  const keyword = document.getElementById("search").value.toLowerCase()
  const container = document.getElementById("results")
  
  if (words.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>还没有单词，请先导入 CSV 文件</p></div>'
    return
  }

  const results = words.filter(item =>
    item.hiragana?.toLowerCase().includes(keyword) ||
    item.katakana?.toLowerCase().includes(keyword) ||
    item.chinese?.toLowerCase().includes(keyword) ||
    item.reading?.toLowerCase().includes(keyword)
  )

  if (results.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>未找到匹配的单词</p></div>'
    return
  }

  container.innerHTML = results
    .map(item => `
      <div class="item">
        <div class="list-item-header">
          <div style="font-size: 1.1em; font-weight: bold; color: var(--text-main);">${item.hiragana} ${item.katakana ? '<span style="color:var(--text-sub); font-weight:normal; font-size:0.9em;">/ ' + item.katakana + '</span>' : ''}</div>
          <button class="mini-voice-btn" onclick="playAudio('${item.hiragana || item.katakana}')">🔊</button>
        </div>
        <div style="color: var(--primary); margin: 8px 0; font-size: 1.05em;">${item.chinese}</div>
        ${item.reading ? `<small style="color: var(--text-sub); background: #f8f9fa; padding: 2px 6px; border-radius: 4px;">${item.reading}</small>` : ''}
      </div>
    `)
    .join("")
}

// 语音播放
function playAudio(text) {
  if (!text) return
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=ja&client=tw-ob`
  const audio = new Audio(url)
  audio.play().catch(e => console.error("Audio playback failed", e))
}

function playCurrentWord() {
  if (shuffledWords.length === 0) return
  const word = shuffledWords[currentIndex]
  playAudio(word.hiragana || word.katakana)
}

// 刷词逻辑
function startFlashcards() {
  if (words.length === 0) {
    alert("请先在搜索页面导入词库")
    return
  }
  shuffledWords = [...words].sort(() => Math.random() - 0.5)
  currentIndex = 0
  displayCard()
}

function displayCard() {
  if (shuffledWords.length === 0) {
    document.getElementById("word-main").textContent = "点击开始"
    document.getElementById("word-sub").textContent = ""
    return
  }

  const word = shuffledWords[currentIndex]
  document.getElementById("word-main").textContent = word.hiragana
  document.getElementById("word-sub").textContent = word.katakana
  document.getElementById("word-chinese").textContent = word.chinese
  document.getElementById("word-reading").textContent = word.reading
  
  showAnswer = false
  updateCardVisibility()
  updateFlashcardHeader()
}

function toggleAnswer() {
  if (shuffledWords.length === 0) return
  showAnswer = !showAnswer
  updateCardVisibility()
}

function updateCardVisibility() {
  const card = document.getElementById("card")
  if (showAnswer) {
    card.classList.add("flipped")
  } else {
    card.classList.remove("flipped")
  }
}

function nextCard() {
  if (shuffledWords.length === 0) {
    startFlashcards()
    return
  }
  currentIndex = (currentIndex + 1) % shuffledWords.length
  displayCard()
}

function prevCard() {
  if (shuffledWords.length === 0) return
  currentIndex = (currentIndex - 1 + shuffledWords.length) % shuffledWords.length
  displayCard()
}

function updateFlashcardHeader() {
  const progress = document.getElementById("progress")
  if (shuffledWords.length > 0) {
    progress.textContent = `${currentIndex + 1} / ${shuffledWords.length}`
  } else {
    progress.textContent = `总词数: ${words.length}`
  }
}
