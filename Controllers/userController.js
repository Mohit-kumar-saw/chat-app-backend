const generateToken = require("../config/generateToken");
const { User } = require("../models/userModel");
const expressAsyncHandler = require("express-async-handler");

// Login
const loginController = expressAsyncHandler(async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide both username and password"
      });
    }

    // Find user by username or email
    const user = await User.findOne({
      $or: [
        { username: username.trim() },
        { email: username.trim().toLowerCase() }
      ]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password"
      });
    }

    const isPasswordValid = await user.matchPassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password"
      });
    }

    res.status(200).json({
      success: true,
      data: {
      _id: user._id,
        username: user.username,
      email: user.email,
        token: generateToken(user._id)
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred during login"
    });
  }
});

// Registration
const registerController = expressAsyncHandler(async (req, res) => {
  try {
    console.log("Registration request:", req.body);
    const { username, email, password } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields: username, email, and password"
      });
    }

    // Check for existing user
    const existingUser = await User.findOne({
      $or: [
        { username: username.trim() },
        { email: email.trim().toLowerCase() }
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email.trim().toLowerCase() 
          ? "Email already registered" 
          : "Username already taken"
      });
    }

    // Create new user
    const user = await User.create({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password
    });

  if (user) {
    res.status(201).json({
        success: true,
        data: {
      _id: user._id,
          username: user.username,
      email: user.email,
          token: generateToken(user._id)
        }
      });
    }
  } catch (error) {
    console.error("Registration error:", error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} is already taken`
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: "An error occurred during registration"
    });
  }
});

const fetchAllUsersController = expressAsyncHandler(async (req, res) => {
  try {
    console.log("Search query:", req.query.search);
    
  const keyword = req.query.search
    ? {
        $or: [
            { username: { $regex: req.query.search, $options: "i" } },
          { email: { $regex: req.query.search, $options: "i" } },
        ],
      }
    : {};

    console.log("Search filter:", keyword);

    const users = await User.find(keyword)
      .find({ _id: { $ne: req.user._id } })
      .select("-password");

    console.log("Found users:", users.length);

    res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error("Fetch users error:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching users"
    });
  }
});

// Reset indexes if needed
const resetIndexesController = expressAsyncHandler(async (req, res) => {
  try {
    await resetIndexes();
    res.json({ message: "Indexes reset successfully" });
  } catch (error) {
    res.status(500);
    throw new Error("Failed to reset indexes");
  }
});

module.exports = {
  loginController,
  registerController,
  fetchAllUsersController,
  resetIndexesController
};
