export function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Join a list room
    socket.on('join-list', ({ shareId }) => {
      socket.join(shareId);
      console.log(`Socket ${socket.id} joined room ${shareId}`);

      const room = io.sockets.adapter.rooms.get(shareId);
      const count = room ? room.size : 0;
      io.to(shareId).emit('user-joined', { shareId, count });
    });

    // Leave a list room
    socket.on('leave-list', ({ shareId }) => {
      socket.leave(shareId);
      console.log(`Socket ${socket.id} left room ${shareId}`);

      const room = io.sockets.adapter.rooms.get(shareId);
      const count = room ? room.size : 0;
      io.to(shareId).emit('user-left', { shareId, count });
    });

    // Handle disconnect: notify all rooms this socket was in
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      // socket.rooms contains the socket's own ID room plus any joined rooms
      for (const room of socket.rooms) {
        if (room !== socket.id) {
          const shareId = room;
          const roomData = io.sockets.adapter.rooms.get(shareId);
          const count = roomData ? roomData.size : 0;
          io.to(shareId).emit('user-left', { shareId, count });
        }
      }
    });
  });
}
