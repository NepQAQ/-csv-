let libraries = {} // { libraryName: [words] }
let currentLibraryName = ""
let words = []
let shuffledWords = []
let currentIndex = 0
let showAnswer = false
let cardMode = "ja-zh" // ja-zh 或 zh-ja
let autoplay = false
let theme = "light"
let touchStartX = 0
let touchEndX = 0
let targetLibraryForImport = "" // 记录当前正在导入的词库名

// 页面加载时读取本地缓存
window.onload = () => {
  loadDataFromCache()
  
  // 加载卡片模式
  const savedMode = localStorage.getItem("cardMode")
  if (savedMode) {
    cardMode = savedMode
    updateModeToggleButton()
  }

  // 加载自动播放设置
  const savedAutoplay = localStorage.getItem("autoplay")
  if (savedAutoplay !== null) {
    autoplay = savedAutoplay === "true"
    const check = document.getElementById("autoplayCheck")
    if (check) check.checked = autoplay
  }

  // 加载主题设置
  const savedTheme = localStorage.getItem("theme")
  if (savedTheme) {
    theme = savedTheme
    applyTheme()
  }

  // 绑定全局事件
  bindGlobalEvents()
  
  switchMode('search')
}

function applyTheme() {
  document.body.setAttribute("data-theme", theme)
  const btn = document.getElementById("themeToggle")
  if (btn) {
    btn.textContent = theme === "light" ? "🌙" : "☀️"
  }
}

function toggleTheme() {
  theme = theme === "light" ? "dark" : "light"
  localStorage.setItem("theme", theme)
  applyTheme()
}

function markAsWrong() {
  if (shuffledWords.length === 0) return
  const currentWord = shuffledWords[currentIndex]
  
  if (!libraries["错题本"]) {
    libraries["错题本"] = []
  }

  // 检查是否已存在
  const exists = libraries["错题本"].some(w => 
    w.hiragana === currentWord.hiragana && w.chinese === currentWord.chinese
  )

  if (!exists) {
    libraries["错题本"].push({...currentWord})
    saveToCache()
    alert("已加入错题本")
  } else {
    alert("错题本中已存在该词")
  }
}

function exportLibrary(name) {
  const libWords = libraries[name]
  if (!libWords || libWords.length === 0) {
    alert("该词库为空，无法导出")
    return
  }

  const csvContent = "平假名,片假名,中文释义,读音\n" + 
    libWords.map(w => `${w.hiragana},${w.katakana},${w.chinese},${w.reading}`).join("\n")

  const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", `${name}_导出.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function bindGlobalEvents() {
  // 键盘事件
  window.addEventListener("keydown", (e) => {
    if (document.activeElement.tagName === "INPUT") return
    const isFlashcardMode = document.getElementById("flashcard-mode").style.display === "flex"
    if (!isFlashcardMode) return

    switch (e.code) {
      case "Space":
        e.preventDefault()
        toggleAnswer()
        break
      case "ArrowRight":
        nextCard()
        break
      case "ArrowLeft":
        prevCard()
        break
      case "KeyV":
        playCurrentWord()
        break
      case "KeyM":
        markAsWrong()
        break
    }
  })

  // 触摸手势
  const cardArea = document.getElementById("card")
  if (cardArea) {
    cardArea.addEventListener("touchstart", (e) => {
      touchStartX = e.changedTouches[0].screenX
    }, { passive: true })

    cardArea.addEventListener("touchend", (e) => {
      touchEndX = e.changedTouches[0].screenX
      handleSwipe()
    }, { passive: true })
  }
}

function handleSwipe() {
  const swipeThreshold = 50
  const diff = touchEndX - touchStartX
  
  // 仅在未翻转卡片时支持左右滑动切题，防止误触
  if (!showAnswer && Math.abs(diff) > swipeThreshold) {
    if (diff > 0) {
      prevCard()
    } else {
      nextCard()
    }
  }
}

function toggleAutoplay() {
  autoplay = document.getElementById("autoplayCheck").checked
  localStorage.setItem("autoplay", autoplay)
}

function toggleCardMode() {
  cardMode = cardMode === "ja-zh" ? "zh-ja" : "ja-zh"
  localStorage.setItem("cardMode", cardMode)
  updateModeToggleButton()
  showAnswer = false // 切换模式时先隐藏答案
  if (shuffledWords.length > 0) {
    displayCard()
  }
}

function updateModeToggleButton() {
  const btn = document.getElementById("modeToggleBtn")
  if (btn) {
    btn.textContent = cardMode === "ja-zh" ? "日 → 中" : "中 → 日"
  }
}

function loadDataFromCache() {
  try {
    const savedLibraries = localStorage.getItem("libraries")
    const savedCurrent = localStorage.getItem("currentLibraryName")
    const oldWords = localStorage.getItem("words")
    
    if (savedLibraries) {
      libraries = JSON.parse(savedLibraries) || {}
    }

    // 如果没有新版库但有旧版词，则创建默认库
    if (Object.keys(libraries).length === 0 && oldWords) {
      const parsedOld = JSON.parse(oldWords)
      if (parsedOld && parsedOld.length > 0) {
        libraries["默认词库"] = parsedOld
        currentLibraryName = "默认词库"
        localStorage.removeItem("words")
      }
    }

    if (savedCurrent && libraries[savedCurrent]) {
      currentLibraryName = savedCurrent
    } else if (Object.keys(libraries).length > 0) {
      currentLibraryName = Object.keys(libraries)[0]
    }

    updateCurrentWords()
    saveToCache()
  } catch (e) {
    console.error("Critical error loading data from cache:", e)
    libraries = {}
    currentLibraryName = ""
    updateCurrentWords()
  }
}

function updateCurrentWords() {
  words = currentLibraryName ? (libraries[currentLibraryName] || []) : []
  const nameEl = document.getElementById("current-library-name")
  if (nameEl) {
    nameEl.textContent = currentLibraryName || "未选择"
  }
  if (words.length > 0) {
    doSearch()
  }
}

function saveToCache() {
  localStorage.setItem("libraries", JSON.stringify(libraries))
  localStorage.setItem("currentLibraryName", currentLibraryName)
}

// 切换模式
function switchMode(mode) {
  // 统一转换模式名称
  if (mode === 'flashcards') mode = 'flashcard'

  const modes = ['search', 'flashcard', 'library']
  modes.forEach(m => {
    const el = document.getElementById(`${m}-mode`)
    const tab = document.getElementById(`${m}Tab`)
    if (el) el.style.display = m === mode ? (m === 'flashcard' ? 'flex' : 'block') : 'none'
    if (tab) tab.className = m === mode ? 'active' : ''
  })

  if (mode === 'library') {
    renderLibraryList()
  } else if (mode === 'search') {
    doSearch()
  }
}

// 词库管理逻辑
function createLibrary() {
  const nameInput = document.getElementById("newLibraryName")
  const name = nameInput.value.trim()
  if (!name) {
    alert("请输入词库名称")
    return
  }
  if (libraries[name]) {
    alert("词库名称已存在")
    return
  }
  libraries[name] = []
  nameInput.value = ""
  if (!currentLibraryName) currentLibraryName = name
  saveToCache()
  updateCurrentWords()
  renderLibraryList()
}

function selectLibrary(name) {
  currentLibraryName = name
  saveToCache()
  updateCurrentWords()
  renderLibraryList()
  alert(`已选择词库: ${name}`)
}

function deleteLibrary(name) {
  if (!confirm(`确定要删除词库 "${name}" 吗？`)) return
  delete libraries[name]
  if (currentLibraryName === name) {
    currentLibraryName = Object.keys(libraries)[0] || ""
  }
  saveToCache()
  updateCurrentWords()
  renderLibraryList()
}

function renameLibrary(oldName) {
  const newName = prompt(`请输入词库 "${oldName}" 的新名称:`, oldName);
  if (newName === null) return; // 用户取消
  
  const trimmedName = newName.trim();
  if (!trimmedName || trimmedName === oldName) return;
  
  if (libraries[trimmedName]) {
    alert("词库名称已存在");
    return;
  }

  // 执行重命名
  libraries[trimmedName] = libraries[oldName];
  delete libraries[oldName];

  // 如果重命名的是当前正在使用的词库
  if (currentLibraryName === oldName) {
    currentLibraryName = trimmedName;
  }

  // 特殊逻辑：如果重命名的是“默认词库”，自动补充一个新的“默认词库”
  if (oldName === "默认词库") {
    libraries["默认词库"] = [];
    alert(`已将 "${oldName}" 重命名为 "${trimmedName}"，并为您创建了新的默认词库。`);
  }

  saveToCache();
  updateCurrentWords();
  renderLibraryList();
}

function triggerImport(name) {
  targetLibraryForImport = name
  document.getElementById("csvFile").click()
}

function renderLibraryList() {
  const container = document.getElementById("library-list")
  if (Object.keys(libraries).length === 0) {
    container.innerHTML = '<div class="empty-state"><p>暂无词库，请先创建一个</p></div>'
    return
  }

  container.innerHTML = Object.keys(libraries).map(name => `
    <div class="library-card ${name === currentLibraryName ? 'active' : ''}">
      <div class="lib-card-main">
        <div class="lib-info">
          <span class="lib-name">${name}</span>
          <span class="lib-count">${libraries[name].length} 个单词</span>
        </div>
        <button class="btn-select ${name === currentLibraryName ? 'active' : ''}" onclick="selectLibrary('${name}')">
          ${name === currentLibraryName ? '正在使用' : '使用此库'}
        </button>
      </div>
      <div class="lib-card-actions">
        <button class="action-btn btn-import" onclick="triggerImport('${name}')" title="导入 CSV">
          <i>📥</i><span>导入</span>
        </button>
        <button class="action-btn btn-export" onclick="exportLibrary('${name}')" title="导出备份">
          <i>📤</i><span>导出</span>
        </button>
        <button class="action-btn btn-rename" onclick="renameLibrary('${name}')" title="重命名">
          <i>✏️</i><span>改名</span>
        </button>
        <button class="action-btn btn-reset" onclick="resetLibraryProgress('${name}')" title="重置进度">
          <i>🔄</i><span>重置</span>
        </button>
        <button class="action-btn btn-delete" onclick="deleteLibrary('${name}')" title="删除词库">
          <i>🗑️</i><span>删除</span>
        </button>
      </div>
    </div>
  `).join("")
}

function resetLibraryProgress(name) {
  if (name === currentLibraryName) {
    currentIndex = 0
    shuffledWords = []
    displayCard()
    updateFlashcardHeader()
    alert(`词库 "${name}" 的刷词进度已重置`)
  } else {
    alert("请先选择该词库后再重置进度")
  }
}

// 导入 CSV 逻辑
function importCSVToLibrary() {
  const file = document.getElementById("csvFile").files[0]
  if (!file || !targetLibraryForImport) return

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
      libraries[targetLibraryForImport] = newWords
      saveToCache()
      updateCurrentWords()
      renderLibraryList()
      alert(`词库 "${targetLibraryForImport}" 导入成功，共 ${newWords.length} 条单词`)
    } else {
      alert("导入失败，请检查 CSV 格式")
    }
    document.getElementById("csvFile").value = "" // 清空 input
  }

  reader.readAsText(file, "utf-8")
}

// 搜索逻辑
function doSearch() {
  const keyword = document.getElementById("search").value.toLowerCase()
  const container = document.getElementById("results")
  
  if (!currentLibraryName || words.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>${!currentLibraryName ? '请先选择一个词库' : '该词库还没有单词，请先导入'}</p></div>`
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

  const highlightText = (text, query) => {
    if (!query) return text
    const regex = new RegExp(`(${query})`, 'gi')
    return text.replace(regex, '<span class="highlight">$1</span>')
  }

  container.innerHTML = results
    .map(item => `
      <div class="item">
        <div class="list-item-header">
          <div style="font-size: 1.1em; font-weight: bold; color: var(--text-main);">${highlightText(item.hiragana, keyword)} ${item.katakana ? '<span style="color:var(--text-sub); font-weight:normal; font-size:0.9em;">/ ' + highlightText(item.katakana, keyword) + '</span>' : ''}</div>
          <button class="mini-voice-btn" onclick="playAudio('${item.hiragana || item.katakana}')">🔊</button>
        </div>
        <div style="color: var(--primary); margin: 8px 0; font-size: 1.05em;">${highlightText(item.chinese, keyword)}</div>
        ${item.reading ? `<small style="color: var(--text-sub); background: var(--tab-inactive); padding: 2px 6px; border-radius: 4px;">${highlightText(item.reading, keyword)}</small>` : ''}
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
    alert("当前词库为空，请先导入词库")
    return
  }
  shuffledWords = [...words].sort(() => Math.random() - 0.5)
  currentIndex = 0
  displayCard()
}

function displayCard() {
  const main = document.getElementById("word-main")
  const sub = document.getElementById("word-sub")
  const chinese = document.getElementById("word-chinese")
  const reading = document.getElementById("word-reading")

  if (shuffledWords.length === 0) {
    main.textContent = "点击卡片开始"
    sub.textContent = "或点击上方打乱按钮"
    return
  }

  const word = shuffledWords[currentIndex]

  if (cardMode === "ja-zh") {
    // 正面日语，背面中文
    main.textContent = word.hiragana
    sub.textContent = word.katakana
    chinese.textContent = word.chinese
    reading.textContent = word.reading
  } else {
    // 正面中文，背面日语
    main.textContent = word.chinese
    sub.textContent = ""
    chinese.textContent = `${word.hiragana} ${word.katakana ? '/ ' + word.katakana : ''}`
    reading.textContent = word.reading
  }
  
  showAnswer = false
  updateCardVisibility()
  updateFlashcardHeader()

  // 如果开启了自动播放，则朗读单词
  if (autoplay) {
    playCurrentWord()
  }
}

function toggleAnswer() {
  if (shuffledWords.length === 0) {
    // 如果还没开始刷词，点击卡片直接开始
    startFlashcards()
    return
  }
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
  
  const card = document.getElementById("card")
  card.classList.add("swipe-left")
  
  setTimeout(() => {
    currentIndex = (currentIndex + 1) % shuffledWords.length
    displayCard()
    card.classList.remove("swipe-left")
    card.classList.add("slide-in-right")
    setTimeout(() => card.classList.remove("slide-in-right"), 300)
  }, 300)
}

function prevCard() {
  if (shuffledWords.length === 0) return
  
  const card = document.getElementById("card")
  card.classList.add("swipe-right")
  
  setTimeout(() => {
    currentIndex = (currentIndex - 1 + shuffledWords.length) % shuffledWords.length
    displayCard()
    card.classList.remove("swipe-right")
    card.classList.add("slide-in-left")
    setTimeout(() => card.classList.remove("slide-in-left"), 300)
  }, 300)
}

function updateFlashcardHeader() {
  const progress = document.getElementById("progress")
  if (shuffledWords.length > 0) {
    progress.textContent = `${currentIndex + 1} / ${shuffledWords.length}`
  } else {
    progress.textContent = `当前词库: ${currentLibraryName} (${words.length} 词)`
  }
}
