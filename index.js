const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { executeCode } = require("./api.js");

const app = express();

// CORS middleware for Express
app.use(cors({
  origin: "http://localhost:5173",
  methods: ["GET", "POST"],
}));


const server = http.createServer(app);
const io = new Server(server);

const socketToUsername = {};

const getAllUsers = (roomId) => {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
    (socketId) => {
      return {
        socketId,
        username: socketToUsername[socketId],
      };
    }
  );
};

io.on("connection", (socket) => {
  socket.on("join", ({ roomId, username }) => {
    socketToUsername[socket.id] = username;
    socket.join(roomId);
    const clients = getAllUsers(roomId);

    //notify all users
    clients.map(({ socketId }) => {
      io.to(socketId).emit("joined", {
        clients,
        username,
        socketId: socket.id,
      });
    });
  });


  socket.on("code-change" , ({roomId , code})=>{
    socket.in(roomId).emit("code-change" , {code});
  })

  socket.on("code-sync" , ({socketId , code})=>{
    io.to(socketId).emit("code-change" , {code});
  })


   // Handle leave-room event
   socket.on("leave-room", ({ roomId, username }) => {
    socket.leave(roomId);
    delete socketToUsername[socket.id];
    
    // Notify all users in the room that this user has left
    const clients = getAllUsers(roomId);
    clients.map(({ socketId }) => {
      io.to(socketId).emit("disconnected", {
        socketId: socket.id,
        username,
      });
    });
  });


  //run code
  socket.on("run-code" , async ({roomId , code , language})=>{
    try{
      console.log("executing...")
      const {run: result} = await executeCode(language , code);
      console.log("resukt:" , result);
      io.in(roomId).emit("run-code" , {result});
    }catch(err){
      io.in(roomId).emit("run-code" , {err: err.message});
    }
  })



  
  //disconnect
  socket.on("disconnecting" , ()=>{
    const rooms = [...socket.rooms];
    rooms.forEach((roomId)=>{
      socket.in(roomId).emit("disconnected", {
        socketId: socket.id,
        username: socketToUsername[socket.id],
      });
    })
    delete socketToUsername[socket.id];
    socket.leave();
  })

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
