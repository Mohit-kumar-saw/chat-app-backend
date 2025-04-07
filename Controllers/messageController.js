const expressAsyncHandler = require("express-async-handler");
const Message = require("../models/messageModel");
const { User } = require("../models/userModel");
const Chat = require("../models/chatModel");

const allMessages = expressAsyncHandler(async (req, res) => {
  try {
    const messages = await Message.find({ chat: req.params.chatId })
      .populate({
        path: "sender",
        select: "username email"
      })
      .populate({
        path: "chat",
        populate: {
          path: "users",
          select: "username email"
        }
      })
      .populate("readBy", "username email");

    if (!messages) {
      return res.status(404).json({ message: "No messages found" });
    }

    // Mark messages as read
    const unreadMessages = messages.filter(
      msg => !msg.readBy.some(user => user._id.toString() === req.user._id.toString())
    );

    if (unreadMessages.length > 0) {
      await Promise.all(
        unreadMessages.map(msg =>
          Message.findByIdAndUpdate(
            msg._id,
            {
              $addToSet: { readBy: req.user._id }
            },
            { new: true }
          )
        )
      );
    }

    res.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ 
      message: "Error fetching messages",
      error: error.message 
    });
  }
});

const sendMessage = expressAsyncHandler(async (req, res) => {
  const { content, chatId } = req.body;

  if (!content || !chatId) {
    console.log("Invalid data passed into request");
    return res.status(400).json({ message: "Content and chatId are required" });
  }

  if (!req.user || !req.user._id) {
    return res.status(401).json({ message: "User not authenticated" });
  }

  try {
    // First verify that the chat exists and user is a member
    const chat = await Chat.findOne({
      _id: chatId,
      users: { $elemMatch: { $eq: req.user._id } }
    }).populate("users", "username email");

    if (!chat) {
      return res.status(403).json({ 
        message: "You are no longer a member of this conversation",
        error: "NOT_MEMBER"
      });
    }

    // Additional check for group chat membership
    if (chat.isGroupChat) {
      const isMember = chat.users.some(user => user._id.toString() === req.user._id.toString());
      if (!isMember) {
        return res.status(403).json({ 
          message: "You are no longer a member of this group",
          error: "NOT_GROUP_MEMBER"
        });
      }
    }

    const newMessage = await Message.create({
      sender: req.user._id,
      content: content,
      chat: chatId,
      readBy: [req.user._id] // Mark as read by sender
    });

    // Populate the message with required fields
    let populatedMessage = await Message.findById(newMessage._id)
      .populate({
        path: "sender",
        select: "username email"
      })
      .populate({
        path: "chat",
        populate: {
          path: "users",
          select: "username email"
        }
      })
      .populate("readBy", "username email");

    // Update the chat's latest message
    await Chat.findByIdAndUpdate(chatId, { 
      latestMessage: populatedMessage._id 
    });

    res.status(200).json(populatedMessage);
  } catch (error) {
    console.error("Error in sendMessage:", error);
    res.status(500).json({ 
      message: "Error sending message",
      error: error.message 
    });
  }
});

module.exports = { allMessages, sendMessage };