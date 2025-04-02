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
const Message = require("./models/messageModel");

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

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URL)
    .then(() => {
        console.log("Database Connected...".yellow.bold);
        
        // Start server only after database is connected
        server.listen(PORT, () => {
            console.log(`App is running on port ${PORT}`.bold.blue);

            const io = require("socket.io")(server, {
                cors: {
                    origin: "*",
                },
                pingTimeout: 60000,
            });

            // Store active users and their socket IDs
            const activeUsers = new Map();
            const userSockets = new Map();

            io.on("connection", (socket) => {
                console.log("New socket connection:", socket.id);

                socket.on("setup", (userData) => {
                    if (userData?.data?._id) {
                        const userId = userData.data._id;
                        socket.join(userId);
                        activeUsers.set(userId, socket.id);
                        userSockets.set(socket.id, userId);
                        socket.emit("connected");
                        console.log(`User ${userId} connected with socket ${socket.id}`);
                    }
                });

                socket.on("join chat", (room) => {
                    socket.join(room);
                    console.log(`User joined chat: ${room}`);
                    socket.emit("connected");
                });

                socket.on("leave chat", (room) => {
                    socket.leave(room);
                    console.log(`User left chat: ${room}`);
                });

                socket.on("new message", (newMessageStatus) => {
                    const chat = newMessageStatus.chat;
                    
                    if (!chat?.users) {
                        console.log("chat.users not defined");
                        return;
                    }

                    chat.users.forEach((userId) => {
                        if (userId === newMessageStatus.sender._id) return;

                        // Emit to the specific user's socket
                        socket.to(userId).emit("message received", newMessageStatus);
                        console.log(`Message sent to user: ${userId}`);
                    });
                });

                socket.on("message read", async ({ messageId, userId, chatId }) => {
                    try {
                        const message = await Message.findByIdAndUpdate(
                            messageId,
                            {
                                $addToSet: { readBy: userId }
                            },
                            { new: true }
                        ).populate("readBy", "username email");

                        if (message) {
                            // Notify other users in the chat about the read status
                            socket.to(chatId).emit("message read update", {
                                messageId,
                                readBy: message.readBy
                            });
                        }
                    } catch (error) {
                        console.error("Error updating message read status:", error);
                    }
                });

                socket.on("typing", (room) => socket.to(room).emit("typing"));
                socket.on("stop typing", (room) => socket.to(room).emit("stop typing"));

                socket.on("disconnect", () => {
                    const userId = userSockets.get(socket.id);
                    if (userId) {
                        activeUsers.delete(userId);
                        userSockets.delete(socket.id);
                        console.log(`User ${userId} disconnected`);
                    }
                });
            });
        });
    })
    .catch((error) => {
        console.error("Error connecting to database:".red.bold, error);
        process.exit(1);
    });

app.use('/user', userRoutes);
app.use('/chat', chatRoutes);
app.use('/message', messageRoutes);

app.use(notFound);
app.use(errorHandler);
