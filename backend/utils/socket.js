// Socket.io instance module
// This allows routes to access the socket.io instance for emitting events

let ioInstance = null

module.exports = {
  setIO: (io) => {
    ioInstance = io
  },
  getIO: () => {
    return ioInstance
  },
}

