const express = require("express");
const dotenv = require("dotenv");
const colors = require("colors");
const cors = require("cors");
const mongoose = require("mongoose");
const userRoutes = require("./Routes/userRoutes");
const chatRoutes = require("./Routes/chatRoutes");
const messageRoutes = require("./Routes/messageRoutes");
const http = require('http');
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(
    cors({
        origin: "*",
    })
);
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
    res.send("app is running...");
});

const connectDb = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log("Database Connected...".yellow.bold);
    } catch (error) {
        console.error("Server is not connected with database", error);
    }
};

connectDb();

app.use('/user', userRoutes);
app.use('/chat', chatRoutes);
app.use('/message', messageRoutes);

app.use(notFound);
app.use(errorHandler);

server.listen(PORT, () => {
    console.log(`App is running on port ${PORT}`.bold.blue);

    const io = require("socket.io")(server, {
        cors: {
            origin: "*",
        },
        pingTimeout: 60000,
    });

    io.on("connection", (socket) => {
        console.log("socket.io connection established");

        socket.on("setup", (user) => {
            socket.join(user.data._id);
            socket.emit("connected");
        });

        socket.on("join chat", (room) => {
            socket.join(room);
            socket.emit("connected");
        });

        socket.on("new message", (newMessageStatus) => {
            var chat = newMessageStatus.chat;
            if (!chat.users) {
                return console.log("chat.users not defined");
            }
            chat.users.forEach((user) => {
                if (user._id == newMessageStatus.sender._id) return;
                io.to(user._id).emit("message received", newMessageStatus);
            });
        });
    });
});
