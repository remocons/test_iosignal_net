import { Server , serverOption  } from 'iosignal'


// serverOption.showMetric = 2
// serverOption.showMessage = "message"
// serverOption.congPort = 8888
// const server = new Server(serverOption )
const server = new Server({port: 7777 , congPort: 8888} )


server.on('text_message', (data, client)=>{
  console.log('text_message', data)
  client.send('hi i am server. your cid is '+ client.cid + ".")
})