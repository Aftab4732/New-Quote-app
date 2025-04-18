import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Heart, RefreshCw, Share2, Download, Moon, Sun, Plus, X, Copy, ArrowRight, Globe, LogOut, User, LogIn } from 'lucide-react';
import axios from 'axios';

const API_URL = 'http://localhost:5000';

const QuoteApp = () => {
  const [quote, setQuote] = useState({ content: "Life isn't about finding yourself. Life is about creating yourself.", author: "George Bernard Shaw" });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [activeTab, setActiveTab] = useState('discover');
  const [favorites, setFavorites] = useState([]);
  const [isAddingQuote, setIsAddingQuote] = useState(false);
  const [categories, setCategories] = useState(['Inspiration', 'Success', 'Love', 'Wisdom', 'Motivation']);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login'); 
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [quotes, setQuotes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newQuote, setNewQuote] = useState({ content: '', author: '', category: '' });

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      setIsLoggedIn(true);
      fetchFavorites(savedToken);
    }
    
    // Initialize theme from localStorage or system preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
    
    fetchCategories();
    fetchRandomQuote();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/categories`);
      if (response.data && response.data.length > 0) {
        const formattedCategories = response.data.map(category => 
          category.charAt(0).toUpperCase() + category.slice(1)
        );
        setCategories(formattedCategories);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchFavorites = async (userToken) => {
    try {
      const response = await axios.get(`${API_URL}/api/favorites`, {
        headers: { Authorization: `Bearer ${userToken || token}` }
      });
      setFavorites(response.data);
    } catch (error) {
      console.error('Error fetching favorites:', error);
    }
  };

  const fetchRandomQuote = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API_URL}/api/random-quote`);
      setQuote(response.data);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching quote:', error);
      setIsLoading(false);
    }
  };

  const fetchQuotesByCategory = async (category) => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API_URL}/api/quotes/category/${category}`);
      setQuotes(response.data);
      if (response.data.length > 0) {
        setQuote(response.data[0]);
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching quotes by category:', error);
      setIsLoading(false);
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const toggleFavorite = async (quoteObj) => {
    if (!isLoggedIn) {
      showToastNotification('Please log in to save favorites');
      setIsAuthModalOpen(true);
      return;
    }

    try {
      const exists = favorites.some(fav => fav.content === quoteObj.content);
      
      if (exists) {
        await axios.delete(`${API_URL}/api/favorites`, {
          headers: { Authorization: `Bearer ${token}` },
          data: { content: quoteObj.content, author: quoteObj.author }
        });
        setFavorites(favorites.filter(fav => fav.content !== quoteObj.content));
        showToastNotification('Removed from favorites');
      } else {
        await axios.post(`${API_URL}/api/favorites`, {
          quote: quoteObj
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setFavorites([...favorites, quoteObj]);
        showToastNotification('Added to favorites');
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      showToastNotification('Error updating favorites');
    }
  };

  const getNextQuote = () => {
    if (selectedCategory === 'all' || quotes.length <= 1) {
      fetchRandomQuote();
    } else {
      const currentIndex = quotes.findIndex(q => q.content === quote.content);
      const nextIndex = (currentIndex + 1) % quotes.length;
      setQuote(quotes[nextIndex]);
    }
  };

  const showToastNotification = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const copyToClipboard = () => {
    const textToCopy = `"${quote.content}" - ${quote.author}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      showToastNotification('Quote copied to clipboard');
    }).catch(() => {
      showToastNotification('Failed to copy');
    });
  };

  const handleAuthFormChange = (e) => {
    setAuthForm({ ...authForm, [e.target.name]: e.target.value });
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const endpoint = authMode === 'login' ? 'login' : 'register';
      const response = await axios.post(`${API_URL}/api/auth/${endpoint}`, authForm);

      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      setToken(response.data.token);
      setUser(response.data.user);
      setIsLoggedIn(true);
      setIsAuthModalOpen(false);

      setAuthForm({ username: '', email: '', password: '' });

      fetchFavorites(response.data.token);
      
      showToastNotification(authMode === 'login' ? 'Logged in successfully' : 'Registered successfully');
    } catch (error) {
      console.error('Auth error:', error);
      showToastNotification(error.response?.data?.error || 'Authentication failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setIsLoggedIn(false);
    setFavorites([]);
    showToastNotification('Logged out successfully');
    setIsMenuOpen(false);
  };

  const handleCategoryClick = (category) => {
    const formattedCategory = category.toLowerCase();
    setSelectedCategory(formattedCategory);
    
    if (formattedCategory === 'all') {
      fetchRandomQuote();
    } else {
      fetchQuotesByCategory(formattedCategory);
    }
  };

  const handleNewQuoteChange = (e) => {
    setNewQuote({ ...newQuote, [e.target.name]: e.target.value });
  };

  const handleAddQuote = async () => {
    if (!newQuote.content || !newQuote.author) {
      showToastNotification('Quote and author are required');
      return;
    }

    try {
      const categories = newQuote.category ? [newQuote.category.toLowerCase()] : [];
      
      await axios.post(`${API_URL}/api/add-quote`, {
        content: newQuote.content,
        author: newQuote.author,
        categories
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      showToastNotification('Quote added successfully');
      setIsAddingQuote(false);
      setNewQuote({ content: '', author: '', category: '' });
      
      if (categories.includes(selectedCategory)) {
        fetchQuotesByCategory(selectedCategory);
      }
    } catch (error) {
      console.error('Error adding quote:', error);
      showToastNotification('Error adding quote');
    }
  };

  const recommendedQuotes = [
    {
      content: "The future belongs to those who believe in the beauty of their dreams.",
      author: "Eleanor Roosevelt"
    },
    {
      content: "It does not matter how slowly you go as long as you do not stop.",
      author: "Confucius"
    },
    {
      content: "Whatever you are, be a good one.",
      author: "Abraham Lincoln"
    }
  ];

  return (
    <div className={`min-h-screen flex flex-col ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Animated Gradient Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className={`absolute inset-0 opacity-10 ${theme === 'dark' ? 'opacity-20' : 'opacity-10'}`}>
          <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
          <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>
      </div>

      {/* Header */}
      <header className={`fixed w-full z-10 ${theme === 'dark' ? 'bg-gray-900/80' : 'bg-white/80'} backdrop-blur-md py-4 px-6 flex justify-between items-center`}>
        <div className="flex items-center space-x-2">
          <motion.div 
            initial={{ rotate: 0 }}
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, repeatType: "loop", ease: "linear" }}
            className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600"
          ></motion.div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">Quotient</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-700/20 transition">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          
          {isLoggedIn ? (
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)} 
              className="flex items-center space-x-1 px-3 py-1.5 rounded-full bg-blue-600/20 text-blue-500 hover:bg-blue-600/30 transition"
            >
              <User size={16} />
              <span className="text-sm font-medium">{user?.username}</span>
            </button>
          ) : (
            <button 
              onClick={() => setIsAuthModalOpen(true)} 
              className="flex items-center space-x-1 px-3 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition"
            >
              <LogIn size={16} />
              <span className="text-sm font-medium">Log In</span>
            </button>
          )}
        </div>
        
        {/* User menu dropdown */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`absolute top-16 right-6 w-48 py-2 rounded-lg shadow-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}
            >
              <div className="px-4 py-2 border-b border-gray-700 mb-1">
                <p className="text-sm font-medium">{user?.username}</p>
                <p className="text-xs opacity-60 truncate">{user?.email}</p>
              </div>
              
              <button 
                onClick={handleLogout}
                className="flex w-full items-center px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 transition"
              >
                <LogOut size={16} className="mr-2" />
                Logout
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main content */}
      <main className="flex-1 pt-24 pb-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
        {/* Tabs */}
        <div className="mb-8 border-b border-gray-700">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('discover')}
              className={`py-2 px-1 border-b-2 transition-colors ${activeTab === 'discover' ? 'border-blue-500 text-blue-500' : 'border-transparent hover:text-gray-300'}`}
            >
              Discover
            </button>
            <button
              onClick={() => {
                setActiveTab('favorites');
                if (isLoggedIn && favorites.length > 0) {
                  setQuote(favorites[0]);
                }
              }}
              className={`py-2 px-1 border-b-2 transition-colors ${activeTab === 'favorites' ? 'border-blue-500 text-blue-500' : 'border-transparent hover:text-gray-300'}`}
            >
              My Favorites
            </button>
          </div>
        </div>

        {/* Categories Scrollable Bar */}
        {activeTab === 'discover' && (
          <div className="mb-8 overflow-x-auto pb-2 -mx-4 px-4">
            <div className="flex space-x-2">
              <button
                onClick={() => handleCategoryClick('all')}
                className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition ${selectedCategory === 'all' ? 'bg-blue-600 text-white' : theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'}`}
              >
                All
              </button>
              
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => handleCategoryClick(category)}
                  className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition ${selectedCategory === category.toLowerCase() ? 'bg-blue-600 text-white' : theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'}`}
                >
                  {category}
                </button>
              ))}
              
              {isLoggedIn && (
                <button
                  onClick={() => setIsAddingQuote(true)}
                  className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition flex items-center ${theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'}`}
                >
                  <Plus size={16} className="mr-1" />
                  Add Quote
                </button>
              )}
            </div>
          </div>
        )}

        {/* Quote Display */}
        {activeTab === 'discover' && (
          <motion.div
            key={quote.content}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className={`relative p-6 sm:p-10 rounded-xl shadow-lg ${theme === 'dark' ? 'bg-gray-800/70' : 'bg-white/90'} backdrop-blur-sm mb-8`}
          >
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-64">
                <RefreshCw size={30} className="animate-spin text-blue-500 mb-4" />
                <p className="text-gray-500">Loading quote...</p>
              </div>
            ) : (
              <>
                <div className="absolute top-4 right-4 flex space-x-2">
                  <button 
                    onClick={() => toggleFavorite(quote)}
                    className={`p-2 rounded-full transition ${favorites.some(fav => fav.content === quote.content) ? 'text-red-500 bg-red-500/10' : theme === 'dark' ? 'text-gray-400 hover:text-red-500 hover:bg-gray-700' : 'text-gray-500 hover:text-red-500 hover:bg-gray-200'}`}
                  >
                    <Heart size={20} fill={favorites.some(fav => fav.content === quote.content) ? "currentColor" : "none"} />
                  </button>
                  
                  <button 
                    onClick={copyToClipboard}
                    className={`p-2 rounded-full transition ${theme === 'dark' ? 'text-gray-400 hover:text-blue-500 hover:bg-gray-700' : 'text-gray-500 hover:text-blue-500 hover:bg-gray-200'}`}
                  >
                    <Copy size={20} />
                  </button>
                  
                  <button 
                    onClick={getNextQuote}
                    className={`p-2 rounded-full transition ${theme === 'dark' ? 'text-gray-400 hover:text-purple-500 hover:bg-gray-700' : 'text-gray-500 hover:text-purple-500 hover:bg-gray-200'}`}
                  >
                    <ArrowRight size={20} />
                  </button>
                </div>
                
                <blockquote className="text-2xl sm:text-3xl font-medium leading-relaxed mb-6">
                  "{quote.content}"
                </blockquote>
                
                <footer className="text-lg opacity-80">
                  — {quote.author}
                </footer>
                
                {quote.categories && quote.categories.length > 0 && (
                  <div className="mt-6 flex flex-wrap gap-2">
                    {quote.categories.map(cat => (
                      <span key={cat} className="px-2 py-1 text-xs rounded-full bg-blue-600/20 text-blue-500">
                        {cat}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* Favorites Display */}
        {activeTab === 'favorites' && (
          <>
            {!isLoggedIn ? (
              <div className={`p-6 rounded-xl shadow-lg ${theme === 'dark' ? 'bg-gray-800/70' : 'bg-white/90'} backdrop-blur-sm text-center`}>
                <p className="mb-4">Please log in to see your favorite quotes</p>
                <button 
                  onClick={() => setIsAuthModalOpen(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Log In
                </button>
              </div>
            ) : favorites.length === 0 ? (
              <div className={`p-6 rounded-xl shadow-lg ${theme === 'dark' ? 'bg-gray-800/70' : 'bg-white/90'} backdrop-blur-sm`}>
                <p className="text-center mb-4">You haven't saved any favorites yet</p>
                <div className="space-y-4">
                  <p className="text-center font-medium">Try these quotes:</p>
                  {recommendedQuotes.map((rec, index) => (
                    <div key={index} className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-700/70' : 'bg-gray-100'}`}>
                      <p className="mb-2">"{rec.content}"</p>
                      <div className="flex justify-between items-center">
                        <p className="text-sm opacity-80">— {rec.author}</p>
                        <button 
                          onClick={() => toggleFavorite(rec)}
                          className="p-1.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-gray-700 transition"
                        >
                          <Heart size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {favorites.map((fav, index) => (
                  <motion.div 
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800/70' : 'bg-white/90'} backdrop-blur-sm`}
                  >
                    <p className="mb-2 text-lg">"{fav.content}"</p>
                    <div className="flex justify-between items-center">
                      <p className="opacity-80">— {fav.author}</p>
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => copyToClipboard(fav)}
                          className={`p-1.5 rounded-full transition ${theme === 'dark' ? 'text-gray-400 hover:text-blue-500 hover:bg-gray-700' : 'text-gray-500 hover:text-blue-500 hover:bg-gray-200'}`}
                        >
                          <Copy size={16} />
                        </button>
                        <button 
                          onClick={() => toggleFavorite(fav)}
                          className="p-1.5 rounded-full text-red-500 bg-red-500/10 hover:bg-red-500/20 transition"
                        >
                          <Heart size={16} fill="currentColor" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Add New Quote Modal */}
        <AnimatePresence>
          {isAddingQuote && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className={`w-full max-w-md rounded-xl shadow-xl p-6 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">Add New Quote</h2>
                  <button 
                    onClick={() => setIsAddingQuote(false)}
                    className="p-1 rounded-full hover:bg-gray-700/20"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Quote</label>
                    <textarea
                      name="content"
                      value={newQuote.content}
                      onChange={handleNewQuoteChange}
                      placeholder="Enter quote text..."
                      className={`w-full p-2 rounded-lg resize-none ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'} border focus:ring-blue-500 focus:border-blue-500`}
                      rows={4}
                    ></textarea>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Author</label>
                    <input
                      type="text"
                      name="author"
                      value={newQuote.author}
                      onChange={handleNewQuoteChange}
                      placeholder="Enter author name..."
                      className={`w-full p-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'} border focus:ring-blue-500 focus:border-blue-500`}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Category (optional)</label>
                    <input
                      type="text"
                      name="category"
                      value={newQuote.category}
                      onChange={handleNewQuoteChange}
                      placeholder="E.g. Inspiration, Success..."
                      className={`w-full p-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'} border focus:ring-blue-500 focus:border-blue-500`}
                    />
                  </div>
                </div>
                
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={() => setIsAddingQuote(false)}
                    className={`px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} transition`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddQuote}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Add Quote
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Auth Modal */}
        <AnimatePresence>
          {isAuthModalOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className={`w-full max-w-md rounded-xl shadow-xl p-6 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold">{authMode === 'login' ? 'Log In' : 'Create Account'}</h2>
                  <button 
                    onClick={() => setIsAuthModalOpen(false)}
                    className="p-1 rounded-full hover:bg-gray-700/20"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  {authMode === 'register' && (
                    <div>
                      <label className="block text-sm font-medium mb-1">Username</label>
                      <input
                        type="text"
                        name="username"
                        value={authForm.username}
                        onChange={handleAuthFormChange}
                        required
                        className={`w-full p-2.5 rounded-lg ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'} border focus:ring-blue-500 focus:border-blue-500`}
                      />
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={authForm.email}
                      onChange={handleAuthFormChange}
                      required
                      className={`w-full p-2.5 rounded-lg ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'} border focus:ring-blue-500 focus:border-blue-500`}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Password</label>
                    <input
                      type="password"
                      name="password"
                      value={authForm.password}
                      onChange={handleAuthFormChange}
                      required
                      className={`w-full p-2.5 rounded-lg ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'} border focus:ring-blue-500 focus:border-blue-500`}
                    />
                  </div>
                  
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition mt-6"
                  >
                    {authMode === 'login' ? 'Log In' : 'Sign Up'}
                  </button>
                </form>
                
                <div className="mt-4 text-center text-sm">
                  {authMode === 'login' ? (
                    <p>
                      Don't have an account?{' '}
                      <button 
                        onClick={() => setAuthMode('register')}
                        className="text-blue-500 hover:underline"
                      >
                        Sign Up
                      </button>
                    </p>
                  ) : (
                    <p>
                      Already have an account?{' '}
                      <button 
                        onClick={() => setAuthMode('login')}
                        className="text-blue-500 hover:underline"
                      >
                        Log In
                      </button>
                    </p>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg bg-gray-800 text-white shadow-lg z-50"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QuoteApp;
