let libraries = {} // { libraryName: { words: [], enabled: true } }
let currentLibraryName = ""
let words = []
let shuffledWords = []
let currentIndex = 0
let showAnswer = false
let cardMode = "ja-zh" // ja-zh 或 zh-ja
let autoplay = false
let theme = "light"
let searchSource = "local" // local 或 online
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
    libraries["错题本"] = { words: [], enabled: true }
  }

  // 检查是否已存在
  const exists = libraries["错题本"].words.some(w => 
    w.hiragana === currentWord.hiragana && w.chinese === currentWord.chinese
  )

  if (!exists) {
    libraries["错题本"].words.push({...currentWord})
    saveToCache()
    alert("已加入错题本")
  } else {
    alert("错题本中已存在该词")
  }
}

function exportLibrary(name) {
  const lib = libraries[name]
  if (!lib || !lib.words || lib.words.length === 0) {
    alert("该词库为空，无法导出")
    return
  }

  const csvContent = "平假名,片假名,中文释义,读音\n" + 
    lib.words.map(w => `${w.hiragana},${w.katakana},${w.chinese},${w.reading}`).join("\n")

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
  showAnswer = false
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
      const parsed = JSON.parse(savedLibraries) || {}
      const firstKey = Object.keys(parsed)[0]
      if (firstKey && Array.isArray(parsed[firstKey])) {
        libraries = {}
        Object.keys(parsed).forEach(name => {
          libraries[name] = { words: parsed[name], enabled: true }
        })
      } else {
        libraries = parsed
      }
    }

    if (Object.keys(libraries).length === 0 && oldWords) {
      const parsedOld = JSON.parse(oldWords)
      if (parsedOld && parsedOld.length > 0) {
        libraries["默认词库"] = { words: parsedOld, enabled: true }
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
  words = currentLibraryName ? (libraries[currentLibraryName]?.words || []) : []
  if (searchSource === 'local') {
    doSearch()
  }
}

function saveToCache() {
  localStorage.setItem("libraries", JSON.stringify(libraries))
  localStorage.setItem("currentLibraryName", currentLibraryName)
}

function switchMode(mode) {
  if (mode === 'flashcards') mode = 'flashcard'
  const modes = ['search', 'flashcard', 'library', 'gojuon']
  modes.forEach(m => {
    const el = document.getElementById(`${m}-mode`)
    const tab = document.getElementById(`${m}Tab`)
    if (el) el.style.display = m === mode ? (m === 'flashcard' ? 'flex' : 'block') : 'none'
    if (tab) tab.className = m === mode ? 'active' : ''
  })

  if (mode === 'library') {
    renderLibraryList()
  } else if (mode === 'search') {
    updateCurrentWords()
    doSearch()
  } else if (mode === 'gojuon') {
    renderGojuonGrid('seion')
  } else if (mode === 'flashcard') {
    updateFlashcardLibrarySelect()
  }
}

function createLibrary() {
  const nameInput = document.getElementById("newLibraryName")
  const name = nameInput.value.trim()
  if (!name) { alert("请输入词库名称"); return }
  if (libraries[name]) { alert("词库名称已存在"); return }
  libraries[name] = { words: [], enabled: true }
  nameInput.value = ""
  if (!currentLibraryName) currentLibraryName = name
  saveToCache()
  renderLibraryList()
}

function toggleLibraryEnabled(name) {
  if (libraries[name]) {
    libraries[name].enabled = !libraries[name].enabled
    saveToCache()
    renderLibraryList()
    updateCurrentWords()
  }
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
  if (newName === null) return;
  const trimmedName = newName.trim();
  if (!trimmedName || trimmedName === oldName) return;
  if (libraries[trimmedName]) { alert("词库名称已存在"); return }
  libraries[trimmedName] = libraries[oldName];
  delete libraries[oldName];
  if (currentLibraryName === oldName) currentLibraryName = trimmedName;
  if (oldName === "默认词库") {
    libraries["默认词库"] = { words: [], enabled: true };
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
  container.innerHTML = Object.keys(libraries).map(name => {
    const lib = libraries[name]
    return `
      <div class="library-card ${lib.enabled ? 'active' : 'disabled'}">
        <div class="lib-card-main">
          <div class="lib-info">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="lib-name">${name}</span>
              <span class="status-badge ${lib.enabled ? 'enabled' : 'disabled'}">${lib.enabled ? '已启用' : '未启用'}</span>
            </div>
            <span class="lib-count">${lib.words.length} 个单词</span>
          </div>
          <button class="btn-toggle-enabled ${lib.enabled ? 'active' : ''}" onclick="toggleLibraryEnabled('${name}')">
            ${lib.enabled ? '禁用' : '启用'}
          </button>
        </div>
        <div class="lib-card-actions">
          <button class="action-btn btn-import" onclick="triggerImport('${name}')"><i>📥</i><span>导入</span></button>
          <button class="action-btn btn-export" onclick="exportLibrary('${name}')"><i>📤</i><span>导出</span></button>
          <button class="action-btn btn-rename" onclick="renameLibrary('${name}')"><i>✏️</i><span>改名</span></button>
          <button class="action-btn btn-reset" onclick="resetLibraryProgress('${name}')"><i>🔄</i><span>重置</span></button>
          <button class="action-btn btn-delete" onclick="deleteLibrary('${name}')"><i>🗑️</i><span>删除</span></button>
        </div>
      </div>
    `
  }).join("")
}

function resetLibraryProgress(name) {
  if (name === currentLibraryName) {
    currentIndex = 0
    shuffledWords = []
    displayCard()
    updateFlashcardHeader()
    alert(`词库 "${name}" 的刷词进度已重置`)
  } else {
    alert("请先在刷词模式选择该词库后再重置进度")
  }
}

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
      if (!libraries[targetLibraryForImport]) libraries[targetLibraryForImport] = { words: [], enabled: true }
      libraries[targetLibraryForImport].words = newWords
      saveToCache()
      updateCurrentWords()
      renderLibraryList()
      alert(`词库 "${targetLibraryForImport}" 导入成功，共 ${newWords.length} 条单词`)
    } else {
      alert("导入失败，请检查 CSV 格式")
    }
    document.getElementById("csvFile").value = ""
  }
  reader.readAsText(file, "utf-8")
}

function setSearchSource(source) {
  searchSource = source
  const localTab = document.getElementById("localSearchTab")
  const onlineTab = document.getElementById("onlineSearchTab")
  const searchBtn = document.getElementById("searchBtn")
  if (source === 'local') {
    localTab.classList.add("active"); onlineTab.classList.remove("active")
    searchBtn.style.display = "none"
    updateCurrentWords()
  } else {
    localTab.classList.remove("active"); onlineTab.classList.add("active")
    searchBtn.style.display = "block"
    document.getElementById("results").innerHTML = '<div class="empty-state"><p>输入后点击“翻译”</p></div>'
  }
}

function handleSearchInput() { if (searchSource === 'local') doSearch() }

function doSearch() {
  const keyword = document.getElementById("search").value.toLowerCase()
  const container = document.getElementById("results")
  const enabledLibs = Object.keys(libraries).filter(name => libraries[name].enabled)
  if (enabledLibs.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>没有启用的词库</p></div>'; return
  }
  let allResults = []
  enabledLibs.forEach(libName => {
    const matches = libraries[libName].words.filter(item =>
      item.hiragana?.toLowerCase().includes(keyword) ||
      item.katakana?.toLowerCase().includes(keyword) ||
      item.chinese?.toLowerCase().includes(keyword) ||
      item.reading?.toLowerCase().includes(keyword)
    )
    matches.forEach(m => allResults.push({ ...m, source: libName }))
  })
  if (allResults.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>未找到匹配项</p></div>`; return
  }
  const highlightText = (text, query) => {
    if (!query) return text
    const regex = new RegExp(`(${query})`, 'gi')
    return text.replace(regex, '<span class="highlight">$1</span>')
  }
  container.innerHTML = allResults.map(item => `
    <div class="item">
      <div class="list-item-header">
        <div style="font-size: 1.1em; font-weight: bold; color: var(--text-main);">${highlightText(item.hiragana, keyword)}</div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 0.7rem; color: var(--text-sub); background: var(--tab-inactive); padding: 2px 6px; border-radius: 4px;">${item.source}</span>
          <button class="mini-voice-btn" onclick="playAudio('${item.hiragana || item.katakana}')">🔊</button>
        </div>
      </div>
      <div style="color: var(--primary); margin: 8px 0;">${highlightText(item.chinese, keyword)}</div>
    </div>
  `).join("")
}

async function doOnlineSearch() {
  const keyword = document.getElementById("search").value.trim()
  const container = document.getElementById("results")
  if (!keyword) { alert("请输入内容"); return }
  container.innerHTML = '<div class="empty-state"><p class="loading-dots">翻译中</p></div>'
  try {
    const isJapanese = /[\u3040-\u30ff\u31f0-\u31ff]/.test(keyword)
    const langPair = isJapanese ? "ja|zh" : "zh|ja"
    const transUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(keyword)}&langpair=${langPair}`
    const transRes = await fetch(transUrl)
    const transData = await transRes.json()
    const translatedText = transData?.responseData?.translatedText || "翻译失败"
    let readingHtml = ""; let examplesHtml = ""
    if (isJapanese) {
      try {
        const jishoUrl = `https://api.allorigins.win/get?url=${encodeURIComponent('https://jisho.org/api/v1/search/words?keyword=' + keyword)}`
        const jishoRes = await fetch(jishoUrl)
        const jishoData = await jishoRes.json()
        if (jishoData && jishoData.contents) {
          const jishoJson = JSON.parse(jishoData.contents)
          if (jishoJson.data && jishoJson.data.length > 0) {
            const entry = jishoJson.data[0]
            const kana = entry.japanese[0].reading || entry.japanese[0].word || ""
            if (kana) {
              const romaji = kanaToRomaji(kana)
              readingHtml = `<div class="online-reading">读音: ${kana} (${romaji})</div>`
            }
          }
        }
      } catch (e) {}
    }
    if (isJapanese && keyword.length < 10) {
      try {
        const tatoebaUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(`https://tatoeba.org/en/api_v1/search?from=jpn&to=cmn&query=${keyword}&trans_filter=limit&trans_to=cmn`)}`
        const tatoebaRes = await fetch(tatoebaUrl)
        const tatoebaData = await tatoebaRes.json()
        if (tatoebaData && tatoebaData.contents) {
          const tatoebaJson = JSON.parse(tatoebaData.contents)
          if (tatoebaJson.results && tatoebaJson.results.length > 0) {
            const examples = tatoebaJson.results.slice(0, 2).map(res => 
              `<div class="example-item"><span class="example-ja">・${res.text}</span><span class="example-zh">${res.translations?.[0]?.[0]?.text || ""}</span></div>`
            ).join("")
            examplesHtml = `<div class="online-examples"><span class="online-label">例句:</span>${examples}</div>`
          }
        }
      } catch (e) {}
    }
    container.innerHTML = `
      <div class="online-result">
        <div class="online-text">${translatedText}</div>
        ${readingHtml}
        <button class="mini-voice-btn" onclick="playAudio('${isJapanese ? keyword : translatedText}')">播放 🔊</button>
        ${examplesHtml}
      </div>
    `
  } catch (error) {
    container.innerHTML = '<div class="empty-state"><p>请求失败</p></div>'
  }
}

function kanaToRomaji(kana) {
  if (!kana) return ""
  const romanTable = {
    'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
    'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
    'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
    'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
    'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
    'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
    'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
    'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
    'ら': 'ra', '利': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
    'わ': 'wa', 'を': 'wo', 'ん': 'n',
    'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
    'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
    'だ': 'da', 'ぢ': 'ji', 'づ': 'zu', 'で': 'de', 'ど': 'do',
    'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
    'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
    'きゃ': 'kya', 'きゅ': 'kyu', 'きょ': 'kyo',
    'しゃ': 'sha', 'しゅ': 'shu', 'しょ': 'sho',
    'ちゃ': 'cha', 'ちゅ': 'chu', 'ちょ': 'cho',
    'にゃ': 'nya', 'にゅ': 'nyu', 'にょ': 'nyo',
    'ひゃ': 'hya', 'ひゅ': 'hyu', 'ひょ': 'hyo',
    'みゃ': 'mya', 'みゅ': 'myu', 'みょ': 'myo',
    'りゃ': 'rya', 'りゅ': 'ryu', 'りょ': 'ryo',
    'ぎゃ': 'gya', 'ぎゅ': 'gyu', 'ぎょ': 'gyo',
    'じゃ': 'ja', 'じゅ': 'ju', 'じょ': 'jo',
    'びゃ': 'bya', 'びゅ': 'byu', 'びょ': 'byo',
    'ぴゃ': 'pya', 'ぴゅ': 'pyu', 'ぴょ': 'pyo',
    'ア': 'a', 'イ': 'i', 'ウ': 'u', 'エ': 'e', 'オ': 'o',
    'カ': 'ka', 'キ': 'ki', '库': 'ku', 'ケ': 'ke', 'コ': 'ko',
    'サ': 'sa', 'シ': 'shi', 'ス': 'su', 'セ': 'se', 'ソ': 'so',
    'タ': 'ta', 'チ': 'chi', 'ツ': 'tsu', 'テ': 'te', 'ト': 'to',
    'ナ': 'na', 'ニ': 'ni', 'ヌ': 'nu', 'ネ': 'ne', 'ノ': 'no',
    'ハ': 'ha', 'ヒ': 'hi', 'フ': 'fu', 'ヘ': 'he', 'ホ': 'ho',
    '马': 'ma', 'ミ': 'mi', 'ム': 'mu', 'メ': 'me', 'モ': 'mo',
    'ヤ': 'ya', 'ユ': 'yu', 'ヨ': 'yo',
    'ラ': 'ra', 'リ': 'ri', 'ル': 'ru', 'レ': 're', 'ロ': 'ro',
    'ワ': 'wa', 'ヲ': 'wo', 'ン': 'n',
    'っ': 'pause', 'ッ': 'pause', 'ー': '-'
  };
  romanTable['り'] = 'ri'; romanTable['ヒ'] = 'hi';
  let res = ''; let i = 0;
  while (i < kana.length) {
    const two = kana.substring(i, i + 2); const one = kana.substring(i, i + 1)
    if (romanTable[two]) { res += romanTable[two]; i += 2 }
    else if (one === 'っ' || one === 'ッ') {
      const next = kana.substring(i + 1, i + 2)
      if (next && next !== 'っ' && next !== 'ッ') {
        const nr = romanTable[next] || ""; if (nr) res += nr[0]
      }
      i += 1
    } else if (one === 'ー') { i += 1 }
    else { res += romanTable[one] || one; i += 1 }
  }
  return res
}

function playAudio(text) {
  if (!text) return
  const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&le=jap`
  new Audio(url).play().catch(() => {
    const altUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=ja&client=tw-ob`
    new Audio(altUrl).play().catch(() => {})
  })
}

function playCurrentWord() {
  if (shuffledWords.length === 0) return
  playAudio(shuffledWords[currentIndex].hiragana || shuffledWords[currentIndex].katakana)
}

function startFlashcards() {
  if (words.length === 0) { alert("词库为空"); return }
  shuffledWords = [...words].sort(() => Math.random() - 0.5)
  currentIndex = 0; displayCard()
}

function displayCard() {
  const main = document.getElementById("word-main"); const sub = document.getElementById("word-sub")
  const chinese = document.getElementById("word-chinese"); const reading = document.getElementById("word-reading")
  if (shuffledWords.length === 0) { main.textContent = "点击开始"; sub.textContent = ""; return }
  const word = shuffledWords[currentIndex]
  if (cardMode === "ja-zh") {
    main.textContent = word.hiragana; sub.textContent = word.katakana
    chinese.textContent = word.chinese; reading.textContent = word.reading
  } else {
    main.textContent = word.chinese; sub.textContent = ""
    chinese.textContent = `${word.hiragana} ${word.katakana ? '/ ' + word.katakana : ''}`
    reading.textContent = word.reading
  }
  showAnswer = false; updateCardVisibility(); updateFlashcardHeader()
  if (autoplay) playCurrentWord()
}

function toggleAnswer() {
  if (shuffledWords.length === 0) { startFlashcards(); return }
  showAnswer = !showAnswer; updateCardVisibility()
}

function updateCardVisibility() {
  const card = document.getElementById("card")
  showAnswer ? card.classList.add("flipped") : card.classList.remove("flipped")
}

function nextCard() {
  if (shuffledWords.length === 0) { startFlashcards(); return }
  const card = document.getElementById("card"); card.classList.add("swipe-left")
  setTimeout(() => {
    currentIndex = (currentIndex + 1) % shuffledWords.length
    displayCard(); card.classList.remove("swipe-left"); card.classList.add("slide-in-right")
    setTimeout(() => card.classList.remove("slide-in-right"), 300)
  }, 300)
}

function prevCard() {
  if (shuffledWords.length === 0) return
  const card = document.getElementById("card"); card.classList.add("swipe-right")
  setTimeout(() => {
    currentIndex = (currentIndex - 1 + shuffledWords.length) % shuffledWords.length
    displayCard(); card.classList.remove("swipe-right"); card.classList.add("slide-in-left")
    setTimeout(() => card.classList.remove("slide-in-left"), 300)
  }, 300)
}

function updateFlashcardHeader() {
  const progress = document.getElementById("progress")
  if (shuffledWords.length > 0) {
    progress.textContent = `${currentIndex + 1} / ${shuffledWords.length}`
  } else {
    progress.textContent = `待开始: ${libraries[currentLibraryName]?.words?.length || 0} 个单词`
  }
}

function updateFlashcardLibrarySelect() {
  const select = document.getElementById("flashcardLibrarySelect")
  const enabledLibs = Object.keys(libraries).filter(name => libraries[name].enabled)
  if (enabledLibs.length === 0) {
    select.innerHTML = '<option value="">无可用词库</option>'; currentLibraryName = ""
  } else {
    select.innerHTML = enabledLibs.map(name => `<option value="${name}" ${name === currentLibraryName ? 'selected' : ''}>${name}</option>`).join("")
    if (!enabledLibs.includes(currentLibraryName)) {
      currentLibraryName = enabledLibs[0]; select.value = currentLibraryName
    }
  }
  shuffledWords = []; currentIndex = 0; displayCard()
}

function changeFlashcardLibrary() {
  currentLibraryName = document.getElementById("flashcardLibrarySelect").value
  saveToCache(); shuffledWords = []; currentIndex = 0; displayCard()
}

const GOJUON_DATA = {
  seion: [
    ['あ', 'ア', 'a'], ['い', 'イ', 'i'], ['う', 'ウ', 'u'], ['え', 'エ', 'e'], ['お', 'オ', 'o'],
    ['か', 'カ', 'ka'], ['き', 'キ', 'ki'], ['く', 'ク', 'ku'], ['け', 'ケ', 'ke'], ['こ', 'コ', 'ko'],
    ['さ', 'サ', 'sa'], ['し', 'シ', 'shi'], ['す', '斯', 'su'], ['セ', 'セ', 'se'], ['そ', 'ソ', 'so'],
    ['た', 'タ', 'ta'], ['ち', 'チ', 'chi'], ['つ', 'ツ', 'tsu'], ['て', 'テ', 'te'], ['と', 'ト', 'to'],
    ['な', 'ナ', 'na'], ['に', 'ニ', 'ni'], ['ぬ', 'ヌ', 'nu'], ['ね', 'ネ', 'ne'], ['の', 'ノ', 'no'],
    ['は', 'ハ', 'ha'], ['ひ', 'ヒ', 'hi'], ['ふ', 'フ', 'fu'], ['へ', 'ヘ', 'he'], ['ほ', 'ホ', 'ho'],
    ['ま', '马', 'ma'], ['み', 'ミ', 'mi'], ['む', 'ム', 'mu'], ['め', 'メ', 'me'], ['も', 'モ', 'mo'],
    ['や', 'ヤ', 'ya'], null, ['ゆ', 'ユ', 'yu'], null, ['よ', 'ヨ', 'yo'],
    ['ら', 'ラ', 'ra'], ['り', 'リ', 'ri'], ['る', 'ル', 'ru'], ['れ', 'レ', 're'], ['ろ', 'ロ', 'ro'],
    ['わ', 'ワ', 'wa'], null, null, null, ['を', 'ヲ', 'wo'],
    ['ん', 'ン', 'n'], null, null, null, null
  ],
  dakuon: [
    ['が', 'ガ', 'ga'], ['ぎ', 'ギ', 'gi'], ['ぐ', 'グ', 'gu'], ['げ', '格', 'ge'], ['ご', 'ゴ', 'go'],
    ['ざ', 'ザ', 'za'], ['じ', 'ジ', 'ji'], ['ず', 'ズ', 'zu'], ['ぜ', 'ゼ', 'ze'], ['ぞ', 'ゾ', 'zo'],
    ['だ', '达', 'da'], ['ぢ', 'ヂ', 'ji'], ['づ', 'ヅ', 'zu'], ['で', 'デ', 'de'], ['ど', '德', 'do'],
    ['ば', '巴', 'ba'], ['び', '比', 'bi'], ['ぶ', '不', 'bu'], ['べ', '倍', 'be'], ['ぼ', '波', 'bo'],
    ['ぱ', '帕', 'pa'], ['ぴ', '皮', 'pi'], ['ぷ', '普', 'pu'], ['ぺ', '佩', 'pe'], ['ぽ', '坡', 'po']
  ],
  youon: [
    ['きゃ', 'キャ', 'kya'], ['きゅ', 'キュ', 'kyu'], ['きょ', 'キョ', 'kyo'], null, null,
    ['しゃ', 'シャ', 'sha'], ['しゅ', 'シュ', 'shu'], ['しょ', 'ショ', 'sho'], null, null,
    ['ちゃ', 'チャ', 'cha'], ['ちゅ', 'チュ', 'chu'], ['ちょ', 'チョ', 'cho'], null, null,
    ['にゃ', 'ニャ', 'nya'], ['にゅ', 'ニュ', 'nyu'], ['にょ', 'ニョ', 'nyo'], null, null,
    ['ひゃ', 'ヒャ', 'hya'], ['ひゅ', 'ヒュ', 'hyu'], ['ひょ', 'ヒょ', 'hyo'], null, null,
    ['みゃ', 'ミャ', 'mya'], ['みゅ', 'ミュ', 'myu'], ['みょ', 'ミョ', 'myo'], null, null,
    ['りゃ', 'リャ', 'rya'], ['りゅ', 'リュ', 'ryu'], ['りょ', 'リョ', 'ryo'], null, null,
    ['ぎゃ', 'ギャ', 'gya'], ['ぎゅ', 'ギュ', 'gyu'], ['ぎょ', 'ギョ', 'gyo'], null, null,
    ['じゃ', 'ジャ', 'ja'], ['じゅ', 'ジュ', 'ju'], ['じょ', 'ジョ', 'jo'], null, null,
    ['びゃ', 'ビャ', 'bya'], ['びゅ', 'ビュ', 'byu'], ['びょ', 'ビョ', 'byo'], null, null,
    ['ぴゃ', 'Pya', 'pya'], ['ぴゅ', 'pyu', 'pyu'], ['ぴょ', 'pyo', 'pyo'], null, null
  ]
}

function renderGojuonGrid(type) {
  const container = document.getElementById("gojuon-grid")
  container.innerHTML = GOJUON_DATA[type].map(item => {
    if (!item) return '<div class="gojuon-item empty"></div>'
    return `
      <div class="gojuon-item" onclick="playAudio('${item[0]}')">
        <div class="kana-row">
          <span class="kana-main">${item[0]}</span>
          <span class="kana-sub">${item[1]}</span>
          <span class="kana-romaji">${item[2]}</span>
        </div>
      </div>
    `
  }).join("")
}

function switchGojuonType(type) {
  document.querySelectorAll('.gojuon-tabs button').forEach(btn => {
    const t = btn.getAttribute('onclick').match(/'(\w+)'/)[1]
    btn.className = t === type ? 'active' : ''
  })
  renderGojuonGrid(type)
}