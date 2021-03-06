/* global $, Mousetrap, chrome, defaults */

const LookListenRead = (() => {
  const last = xs => xs[xs.length - 1]
  const info = s => console.log('LookListenRead: ' + s)

  let playing = false
  let chunkIx = null
  let blockIx = null
  let options
  let voice
  let startPos = {x: null, y: null}
  let insideMode = false
  const chunks = []
  const blocks = []
  const utterances = []
  const blastClass = 'looklistenread'
  const initVoice = next => {
    const voices = speechSynthesis.getVoices()
    info('Found voices: ' + voices.length)
    voice = voices.find(v => v.name === options.voice)
    if (voice) {
      next()
    } else {
      info(options.voice + ' not found. Listening for onvoiceschanged()...')
      speechSynthesis.onvoiceschanged = () => initVoice(next)
    }
  }

  const speakText = (text, next) => {
    const msg = Object.assign(new SpeechSynthesisUtterance(text), {
      rate: options.rate,
      voice: voice,
      onend: () => playing && next(),
      onerror: info,
    })
    utterances.push(msg) // see http://stackoverflow.com/a/35935851/713303
    speechSynthesis.speak(msg)
  }


  /* Chunk is a set of blast nodes sharing common block-style parent. Nodes in chunk are
     uttered and highlighted together. */
  const initChunks = () => {

    const displayType = elem =>
      (elem.currentStyle || window.getComputedStyle(elem, '')).display

    const closestBlock = elem => {
      while (displayType(elem) !== 'block' && elem.parentNode) {
        elem = elem.parentNode
      }
      return elem
    }

    document.normalize()
    $('body').blast({ delimiter: options.delimiter, customClass: blastClass })
    const regexFilter = new RegExp(options.regexFilter)
    const regexIgnore = new RegExp(options.regexIgnore)
    Array.from(document.getElementsByClassName(blastClass))
      .filter(span => regexFilter.test(span.innerText) && !regexIgnore.test(span.innerText))
         .forEach(span => {
           const chunk = chunks.length > 0 ? last(chunks) : null
           const block = closestBlock(span)
           if (chunk && chunk.block === block &&
               chunk.text.length + span.innerText.length <= options.maxLength
           ) {
             chunk.nodes.push(span)
             chunk.text += ' ' + span.innerText
           } else {
             const i = chunks.length
             chunks.push({
               nodes: [span],
               text: span.innerText,
               block: block,
               ix: i,
               actions: [],
             })
             blocks.length > 0 && last(blocks).node === block ?
                     last(blocks).chunkIxs.push(i) :
                     blocks.push({node: block, chunkIxs: [i], actions: []})
           }
         })
  }
  
  const closestChunk = elem => elem instanceof HTMLElement && (
    elem.classList.contains(blastClass) && chunks.find(
      chunk => chunk.nodes.includes(elem)) ||
    Array.from(elem.childNodes).reduce(
      (chunk, child) => chunk || closestChunk(child), null) ||
    closestChunk(elem.nextSibling)
  ) || null

  const bringToRange = (i, xs) => {
    return i == null ? i : Math.max(0, Math.min(xs.length - 1, i))
  }

  const play = () => {
    chunkIx != null || gotoChunk(0)
    playing = true
    speakText(chunks[chunkIx].text, () => {
      chunkIx < chunks.length - 1 ? gotoChunk(chunkIx + 1) && play() : pause()
    })
  }
  
  const pause = () => {
    playing = false
    speechSynthesis.cancel()
  }

  const pauseOrResume = () => playing ? pause() : play()

  const reset = startPlaying => {
    if (playing) {
      pause()
      setTimeout(play, 30)
    } else if (startPlaying) {
      play()
    }
  }

  const stop = () => {
    pause()
    gotoChunk(null)
  }

  const gotoBlock = (i) => {
    i = bringToRange(i, blocks)
    blockIx === i || gotoChunk(blocks[i].chunkIxs[0]) && reset()
  }

  // Go to new chunk index, highlight the chunk nodes and return true if new chunk index is
  // not null.
  const gotoChunk = (i) => {
    i = bringToRange(i, chunks)
    if (chunkIx !== i) {
      chunkIx != null &&
        chunks[chunkIx].nodes.forEach(node => $(node).removeClass('llr-active'))
      chunkIx = i
      blockIx = blocks.findIndex(block => block.chunkIxs.includes(chunkIx))
      if (chunkIx != null) {
        chunks[chunkIx].nodes.forEach(node => $(node).addClass('llr-active'))
        chunks[chunkIx].nodes[0].scrollIntoViewIfNeeded()
      }
    }
    return chunkIx != null
  }
  
  const speedup = percentage => {
    options.rate *= 1 + 0.01 * percentage
    reset()
  }

  const bindHotkey = (hotkey, action) => Mousetrap.bind(hotkey, () => {
    action()
    return false
  })

  const addListeners = (event, action) => {
    chunks.forEach(chunk => {
      chunk.actions[event] = action(chunk)
      chunk.nodes.forEach(elem => elem.addEventListener(event, chunk.actions[event]))
    })
    blocks.forEach(block => {
      block.actions[event] = action(block)
      block.node.addEventListener(event, block.actions[event])
    })
  }

  const removeListeners = event => {
    chunks.forEach(chunk => chunk.nodes.forEach(elem =>
      elem.removeEventListener(event, chunk.actions[event])))
    blocks.forEach(block => block.node.removeEventListener(event, block.actions[event]))
  }

  const firstChunkIx = readable => readable.ix != null ? readable.ix : readable.chunkIxs[0]

  const startFromPoint = () => {
    const elem = document.elementFromPoint(startPos.x, startPos.y)
    console.log(elem)
    const chunk = closestChunk(elem)
    gotoChunk(chunk ? chunk.ix : 0)
    reset(true)
  }
  
  const commands = {
    next: () => gotoChunk(chunkIx + 1) && reset(),
    previous: () => gotoChunk(chunkIx - 1) && reset(),
    nextBlock: () => gotoBlock(blockIx + 1),
    previousBlock: () => gotoBlock(blockIx - 1),
    pauseOrResume: () => pauseOrResume(),
    slowdown: () => speedup(-10),
    speedup: () => speedup(10),
    exitMode: () => exitMode(),
  }

  const enterMode = () => {
    initChunks()
    Mousetrap.unbind(options.hotkeys.enterMode)
    Object.keys(commands).forEach(cmd => bindHotkey(options.hotkeys[cmd], commands[cmd]))
    addListeners('dblclick', readable => e => {
      gotoChunk(firstChunkIx(readable)) && reset(true)
      e.stopPropagation()
    })
    insideMode = true
    info('Enter speaking mode')
  }

  const exitMode = () => {
    stop()
    Object.keys(commands).forEach(cmd => Mousetrap.unbind(options.hotkeys[cmd]))
    removeListeners('dblclick')
    bindHotkey(options.hotkeys.exitMode, exitMode)
    bindHotkey(options.hotkeys.enterMode, enterMode)
    insideMode = false
    info('Exit speaking mode')
  }

  return opts => {
    options = opts
    console.log(opts)
    document.body.addEventListener('contextmenu', e =>
        startPos = {x: e.pageX - window.pageXOffset, y: e.pageY - window.pageYOffset})
    initVoice(() => {
      info('Initialized voice')
      bindHotkey(options.hotkeys.enterMode, enterMode)
      chrome.extension.onMessage.addListener(message => {
        if (message.action === 'start') {
          insideMode || enterMode()
          startFromPoint()
        }
      })
    })
  }

})()

/* console.log ("injected " + document.body.hasAttribute("looklistenread"))*/
if (!document.body.hasAttribute('looklistenread')) {
  document.body.setAttribute('looklistenread', 1)
  chrome.storage.sync.get(defaults, LookListenRead)
}
/* console.log("Injected LookListenRead...")*/
