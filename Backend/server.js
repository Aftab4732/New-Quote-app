const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from React build in production
app.use(express.static(path.join(__dirname, 'client/build')));

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// In-memory user storage (would be a database in production)
let users = [];

// Try to load users from file
const loadUsers = async () => {
  try {
    const data = await fs.readFile(path.join(__dirname, 'users.json'), 'utf8');
    users = JSON.parse(data);
    console.log('Users loaded from file');
  } catch (error) {
    console.log('No existing users found, starting fresh');
  }
};

// Save users to file
const saveUsers = async () => {
  try {
    await fs.writeFile(
      path.join(__dirname, 'users.json'), 
      JSON.stringify(users), 
      'utf8'
    );
    console.log('Users saved to file');
  } catch (error) {
    console.error('Error saving users:', error);
  }
};

// Load users on startup
loadUsers();

// Fallback quotes that will always work
const fallbackQuotes = [
  { content: "Be yourself; everyone else is already taken.", author: "Oscar Wilde", categories: ["wisdom", "inspiration"] },
  { content: "The only way to do great work is to love what you do.", author: "Steve Jobs", categories: ["success", "motivation"] },
  { content: "Life is what happens when you're busy making other plans.", author: "John Lennon", categories: ["life", "wisdom"] },
  { content: "In three words I can sum up everything I've learned about life: it goes on.", author: "Robert Frost", categories: ["life", "wisdom"] },
  { content: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt", categories: ["inspiration", "success"] },
  { content: "Be the change that you wish to see in the world.", author: "Mahatma Gandhi", categories: ["inspiration", "wisdom"] },
  { content: "Everything you can imagine is real.", author: "Pablo Picasso", categories: ["creativity", "inspiration"] },
  { content: "The best way to predict the future is to create it.", author: "Abraham Lincoln", categories: ["success", "motivation"] },
  { content: "If you tell the truth, you don't have to remember anything.", author: "Mark Twain", categories: ["wisdom", "humor"] },
  { content: "A room without books is like a body without a soul.", author: "Cicero", categories: ["wisdom", "life"] },
  { content: "You miss 100% of the shots you don't take.", author: "Wayne Gretzky", categories: ["success", "motivation"] },
  { content: "Love all, trust a few, do wrong to none.", author: "William Shakespeare", categories: ["love", "wisdom"] },
  { content: "The way to get started is to quit talking and begin doing.", author: "Walt Disney", categories: ["success", "motivation"] },
  { content: "The only impossible journey is the one you never begin.", author: "Tony Robbins", categories: ["inspiration", "motivation"] },
  { content: "The purpose of our lives is to be happy.", author: "Dalai Lama", categories: ["happiness", "life"] }
];

// Cache for quotes and user favorites
let quoteCache = {
  all: [...fallbackQuotes],  // Initialize with fallback quotes
  byCategory: {}
};

// Initialize categories from fallback quotes
const categories = [...new Set(fallbackQuotes.flatMap(quote => quote.categories))];

// Prepare category caches
categories.forEach(category => {
  quoteCache.byCategory[category] = fallbackQuotes.filter(q => 
    q.categories && q.categories.includes(category)
  );
});

// Try loading cached quotes from file on startup
const loadQuoteCache = async () => {
  try {
    const data = await fs.readFile(path.join(__dirname, 'quoteCache.json'), 'utf8');
    const loadedCache = JSON.parse(data);
    
    // Merge loaded cache with existing cache
    quoteCache.all = [...new Set([...quoteCache.all, ...loadedCache.all])];
    
    // Update category caches
    categories.forEach(category => {
      if (loadedCache.byCategory[category]) {
        quoteCache.byCategory[category] = [
          ...new Set([...quoteCache.byCategory[category], ...loadedCache.byCategory[category]])
        ];
      }
    });
    
    console.log('Quote cache loaded from file');
  } catch (error) {
    console.log('No existing quote cache found, using fallback quotes');
  }
};

// Save cache to file periodically
const saveQuoteCache = async () => {
  try {
    await fs.writeFile(
      path.join(__dirname, 'quoteCache.json'), 
      JSON.stringify(quoteCache), 
      'utf8'
    );
    console.log('Quote cache saved to file');
  } catch (error) {
    console.error('Error saving quote cache:', error);
  }
};

// Load cache on startup
loadQuoteCache();
// Save cache every 10 minutes
setInterval(saveQuoteCache, 10 * 60 * 1000);
// Save users every 10 minutes
setInterval(saveUsers, 10 * 60 * 1000);

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Endpoint to get random quote
app.get('/api/random-quote', async (req, res) => {
  try {
    // Try using a real API
    try {
      const response = await axios.get('https://api.quotable.io/random', { timeout: 2000 });
      const quote = {
        content: response.data.content,
        author: response.data.author,
        categories: response.data.tags || []
      };
      
      // Add to cache if it's a new quote
      if (!quoteCache.all.some(q => q.content === quote.content && q.author === quote.author)) {
        quoteCache.all.push(quote);
        
        // Add to category caches
        if (quote.categories) {
          quote.categories.forEach(category => {
            if (!quoteCache.byCategory[category]) {
              quoteCache.byCategory[category] = [];
            }
            quoteCache.byCategory[category].push(quote);
          });
        }
      }
      
      return res.json(quote);
    } catch (error) {
      console.log('External API failed, using fallback quotes');
    }
    
    // If API fails, use cached quotes or fallbacks
    const randomIndex = Math.floor(Math.random() * quoteCache.all.length);
    res.json(quoteCache.all[randomIndex]);
  } catch (error) {
    console.error('Error fetching random quote:', error);
    // Last resort - always return something
    res.json(fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)]);
  }
});

// Get quotes by category
app.get('/api/quotes/category/:category', async (req, res) => {
  try {
    const category = req.params.category.toLowerCase();
    
    // Try the external API first
    try {
      const response = await axios.get(`https://api.quotable.io/quotes?tags=${category}`, { timeout: 2000 });
      const quotes = response.data.results.map(q => ({
        content: q.content,
        author: q.author,
        categories: q.tags || []
      }));
      
      if (quotes.length > 0) {
        // Add to category cache
        if (!quoteCache.byCategory[category]) {
          quoteCache.byCategory[category] = [];
        }
        quotes.forEach(quote => {
          if (!quoteCache.byCategory[category].some(q => q.content === quote.content)) {
            quoteCache.byCategory[category].push(quote);
          }
          // Also add to the all quotes cache
          if (!quoteCache.all.some(q => q.content === quote.content)) {
            quoteCache.all.push(quote);
          }
        });
        
        return res.json(quotes);
      }
    } catch (error) {
      console.log(`External API failed for category ${category}, using cache`);
    }
    
    // If external API fails, use cached quotes for this category
    if (quoteCache.byCategory[category] && quoteCache.byCategory[category].length > 0) {
      return res.json(quoteCache.byCategory[category]);
    }
    
    // Last resort: filter fallback quotes by category
    const filteredQuotes = fallbackQuotes.filter(q => 
      q.categories && q.categories.includes(category)
    );
    
    res.json(filteredQuotes.length > 0 ? filteredQuotes : fallbackQuotes.slice(0, 5));
  } catch (error) {
    console.error('Error fetching quotes by category:', error);
    res.status(500).send('Error fetching quotes');
  }
});

// Get all categories
app.get('/api/categories', async (req, res) => {
  try {
    // Try the external API first
    try {
      const response = await axios.get('https://api.quotable.io/tags', { timeout: 2000 });
      if (response.data && response.data.length > 0) {
        const apiCategories = response.data.map(tag => tag.name.toLowerCase());
        // Merge with our existing categories and remove duplicates
        const allCategories = [...new Set([...categories, ...apiCategories])];
        return res.json(allCategories);
      }
    } catch (error) {
      console.log('External categories API failed, using fallback categories');
    }
    
    // Return our predefined categories if API fails
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json(categories); // Always return something
  }
});

// User registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Check if user already exists
    if (users.some(user => user.email === email || user.username === username)) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new user
    const newUser = {
      id: users.length + 1,
      username,
      email,
      password: hashedPassword,
      favorites: [],
      createdAt: new Date()
    };
    
    users.push(newUser);
    await saveUsers();
    
    // Generate token
    const token = jwt.sign({ id: newUser.id, username }, JWT_SECRET, { expiresIn: '7d' });
    
    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email
      }
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Error registering user' });
  }
});

// User login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Find user
    const user = users.find(user => user.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate token
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      message: 'Logged in successfully',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Error logging in' });
  }
});

// Get user favorites
app.get('/api/favorites', authenticateToken, (req, res) => {
  try {
    const user = users.find(user => user.id === req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user.favorites || []);
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ error: 'Error fetching favorites' });
  }
});

// Add to favorites
app.post('/api/favorites', authenticateToken, async (req, res) => {
  try {
    const { quote } = req.body;
    
    if (!quote || !quote.content || !quote.author) {
      return res.status(400).json({ error: 'Valid quote is required' });
    }
    
    const user = users.find(user => user.id === req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Initialize favorites array if it doesn't exist
    if (!user.favorites) {
      user.favorites = [];
    }
    
    // Check if quote is already in favorites
    if (user.favorites.some(q => q.content === quote.content && q.author === quote.author)) {
      return res.status(400).json({ error: 'Quote already in favorites' });
    }
    
    // Add to favorites
    user.favorites.push(quote);
    await saveUsers();
    
    res.status(201).json({ message: 'Quote added to favorites', favorites: user.favorites });
  } catch (error) {
    console.error('Error adding to favorites:', error);
    res.status(500).json({ error: 'Error adding to favorites' });
  }
});

// Remove from favorites
app.delete('/api/favorites', authenticateToken, async (req, res) => {
  try {
    const { content, author } = req.body;
    
    if (!content || !author) {
      return res.status(400).json({ error: 'Content and author are required' });
    }
    
    const user = users.find(user => user.id === req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Remove from favorites
    if (user.favorites) {
      user.favorites = user.favorites.filter(q => 
        q.content !== content || q.author !== author
      );
      await saveUsers();
    }
    
    res.json({ message: 'Quote removed from favorites', favorites: user.favorites });
  } catch (error) {
    console.error('Error removing from favorites:', error);
    res.status(500).json({ error: 'Error removing from favorites' });
  }
});

// Add a new quote
app.post('/api/add-quote', authenticateToken, async (req, res) => {
  try {
    const { content, author, categories } = req.body;
    
    if (!content || !author) {
      return res.status(400).json({ error: 'Content and author are required' });
    }
    
    const newQuote = {
      content,
      author,
      categories: categories || [],
      addedBy: req.user.username
    };
    
    // Add to global cache
    quoteCache.all.push(newQuote);
    
    // Add to category caches
    if (newQuote.categories) {
      newQuote.categories.forEach(category => {
        if (!quoteCache.byCategory[category]) {
          quoteCache.byCategory[category] = [];
        }
        quoteCache.byCategory[category].push(newQuote);
      });
    }
    
    // Save cache immediately
    await saveQuoteCache();
    
    res.status(201).json(newQuote);
  } catch (error) {
    console.error('Error adding quote:', error);
    res.status(500).send('Error adding quote');
  }
});

// For any other routes, send the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));