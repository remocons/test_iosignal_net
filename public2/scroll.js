
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

let robotChannel = '#robot'

buttonUp.addEventListener('click', () => {
  io.signal(robotChannel, 'u')
  console.log('click up', robotChannel)
})

buttonLeft.addEventListener('click', () => {
  io.signal(robotChannel, 'l')
})

buttonStop.addEventListener('click', () => {
  io.signal(robotChannel, 's')
})

buttonRight.addEventListener('click', () => {
  io.signal(robotChannel, 'r')
})

buttonDown.addEventListener('click', () => {
  io.signal(robotChannel, 'd')
})

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
// console.log('sendButtons', sendButtons )

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

let motor_pwm = new IO.Buffer.alloc(4)

m1a.addEventListener('input', e => {
  setMotorPWM(0, e.target.value)
})
m1b.addEventListener('input', e => {
  setMotorPWM(1, e.target.value)
})
m2a.addEventListener('input', e => {
  setMotorPWM(2, e.target.value)
})
m2b.addEventListener('input', e => {
  setMotorPWM(3, e.target.value)
})


function setMotorPWM(index, value) {
  motor_pwm[index] = value
  console.log(Array.from(motor_pwm))
  io.signal(robotChannel, motor_pwm)
}

function setMotors(m1a = 0, m1b = 0, m2a = 0, m2b = 0) {
  motor_pwm[0] = m1a
  motor_pwm[1] = m1b
  motor_pwm[2] = m2a
  motor_pwm[3] = m2b
  console.log(Array.from(motor_pwm))
}


let lastDirection = ''
const S2 = 220
const S3 = 190
function setDirection(dir) {
  switch (dir) {
    case 'f':
      setMotors(255, 0, 0, 255)
      break;
    case 'fl':
      setMotors(255, 0, 0, S2)
      break;
    case 'fr':
      setMotors(S2, 0, 0, 255)
      break;
    case 'l':
      setMotors(S3, 0, 0, 0)
      break;
    case 'r':
      setMotors(0, 0, 0, S3)
      break;
    case 'b':
      setMotors(0, 255, 255, 0)
      break;
    case 'bl':
      setMotors(0, 255, S2, 0)
      break;
    case 'br':
      setMotors(0, S2, 255, 0)
      break;
    default: //centor stop
      setMotors(0, 0, 0, 0)
      break;

  }
  io.signal(robotChannel, motor_pwm)
}



touchPad.addEventListener('touchstart', parseTochEventPosition)
touchPad.addEventListener('touchmove', parseTochEventPosition)
touchPad.addEventListener('touchend', evt => {
  coord.innerText = "touch end"
  lastDirection = ""
  setDirection("")
})

function parseTochEventPosition(evt) {
  evt.preventDefault();
  const touches = evt.changedTouches;
  // console.log(touches.length)
  // console.log(touches[0].clientX)
  let rect = touchPad.getBoundingClientRect()
  // console.log( rect )
  let w = rect.width
  let h = rect.height
  let cx = w / 2
  let cy = h / 2
  let x = (touches[0].clientX - rect.left - cx) / cx
  let y = (touches[0].clientY - rect.top - cy) / cy

  const dx = 0.3;
  const dy = 0.3;
  let dirX = ""
  let dirY = ""

  if (Math.abs(y) < dy) {
    dirY = ""
  } else if (y < 0) {
    dirY = "f"
  } else if (y > 0) {
    dirY = "b"
  }

  if (Math.abs(x) < dx) {
    dirX = ""
  } else if (x < 0) {
    dirX = "l"
  } else if (x > 0) {
    dirX = "r"
  }


  let direction = dirY + dirX
  if (lastDirection != direction) {
    setDirection(direction)
    lastDirection = direction
    console.log('new direction:', direction)
  } else {

  }
  // coord.innerText = `${direction} x:${x.toFixed(2)} y:${y.toFixed(2)}`
  coord.innerText = `${direction}`
}


// io.open( 'wss://io.iosignal.net/ws' )