import { Server , serverOption  } from 'iosignal'


// serverOption.showMetric = 2
// serverOption.showMessage = "message"
// serverOption.congPort = 8888
// const server = new Server(serverOption )
const server = new Server({port: 7777 , congPort: 8888} )


