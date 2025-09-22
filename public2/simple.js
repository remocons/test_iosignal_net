
let url = 'wss://io.iosignal.net/ws'
let io = new IO()
let channelTag = '#homeButton'


let beginWith = document.location.hostname.split('.')[0]
if (beginWith == '192' || beginWith == '172' || beginWith == '10') {
  url = 'ws://' + document.location.hostname + ':7777'
}

serverURL.value = url;
currentURL.value = url;

function menuSelect(e) {
  console.log('select', e)
}

currentURL.addEventListener('input', e => {
  serverURL.value = currentURL.value
})

let urls = document.querySelectorAll('#urlMenu > a')

for (const m of urls) {
  // console.log(m)
  m.addEventListener('click', () => {
    let url = m.children[1].innerText
    serverURL.value = url
    currentURL.value = url
  })

}

connectButton.addEventListener('click', e => {
  io.open(serverURL.value)
})

closeButton.addEventListener('click', e => {
  io.stop()
})

modeButton.addEventListener('click', e => {
  let modeIcon = document.querySelector('#modeButton > i')
  if (modeIcon.innerText === 'light_mode') {
    ui('mode', 'light')
    modeIcon.innerText = 'dark_mode'
  } else {
    ui('mode', 'dark')
    modeIcon.innerText = 'light_mode'
  }
})

io.on('close', () => {
  ioCID.innerText = "-"
  ioURL.innerText = "-"
  ui_send.hidden = true
  ui_message.hidden = true
  connectButton.disabled = false
  ui("#io_closed", 800);
})

let stateLog = []
function stateLogger(stateName) {
  // console.log('stateLogger:',stateName, io.stateName , io.state)
  stateLog.push(stateName)
  if (stateLog.length > 7) {
    stateLog.shift()
  }
  console.log('stateLog', stateLog)
}

io.on('change', (stateName) => {
  // stateLogger(stateName)
  ioState.innerText = io.state; // Number
  ioStateName.innerText = io.stateName; // String
})


io.on('error', (e) => {
  console.log('err', e)
})


io.on('ready', () => {
  ioCID.innerText = io.cid
  ioURL.innerText = io.url
  ui_send.hidden = false
  ui_message.hidden = false
  connectButton.disabled = true
  ui("#io_ready", 800);

})

io.listen(channelTag, onMessage)

function onMessage(...args) {
  console.log(args[0], typeof args[0]) // message 
  let isBuffer = IO.Buffer.isBuffer(args[0])
  if (isBuffer) {
    let buf = args[0]
    console.log('buffer', buf.toString('hex'))
  }

  let msg = JSON.stringify(args)
  let p = document.createElement('article')
  p.textContent = "🕑 " + String(Date.now() - beginAt) + " " + msg
  let v = document.querySelector('#messageView')
  if (v.childElementCount > 3) {
    v.removeChild(v.lastElementChild)
  }
  v.prepend(p)
  toggleLightBulb();
}

let beginAt = Date.now()


function toggleLightBulb() {
  let buttonState = light_bulb.style.fill
  if (buttonState == "gray") {
    light_bulb.style.fill = "rgb(255,200,0)"
  } else {
    light_bulb.style.fill = "gray"
  }
}

let sendButtons = document.querySelectorAll('#ui_send > article > button')
console.log('sendButtons', sendButtons )

for (const b of sendButtons) {
  b.addEventListener('click', e => {
    console.log(b.innerText)
    eval(b.innerText)
  })
}


io.on('@', onMessage)

io.on('text_message', data => {
  console.log(data)
})

