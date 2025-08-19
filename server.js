const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: ['https://celia92000.github.io', 'http://localhost:3000', 'http://localhost:3001'],
    credentials: true
}));
app.use(express.json());

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://celiaivorra95:etTlRYMlQattYIgV9A@cluster0.t3fu9bb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('✅ Connected to MongoDB');
}).catch(err => {
    console.error('❌ MongoDB connection error:', err);
});

// Basic route for testing
app.get('/', (req, res) => {
    res.json({ 
        message: 'LAIA SKIN API is running',
        status: 'online',
        timestamp: new Date().toISOString()
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// Appointments routes
app.get('/api/appointments', async (req, res) => {
    try {
        // Pour l'instant, retourner des données de test
        const appointments = [];
        res.json({ appointments });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/appointments', async (req, res) => {
    try {
        const appointmentData = req.body;
        
        // Créer un ID temporaire
        const newAppointment = {
            _id: `apt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...appointmentData,
            createdAt: new Date().toISOString(),
            status: 'confirmé'
        };
        
        res.status(201).json(newAppointment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin appointments route
app.get('/api/admin/appointments', async (req, res) => {
    try {
        const appointments = [];
        res.json({ appointments });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Occupied slots route
app.get('/api/appointments/occupied-slots', async (req, res) => {
    try {
        const occupiedSlots = [];
        res.json({ occupiedSlots });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Loyalty points route
app.post('/api/loyalty/points', async (req, res) => {
    try {
        const { clientId, points } = req.body;
        res.json({ 
            clientId,
            totalPoints: points,
            message: 'Points added successfully'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Something went wrong!',
        message: err.message 
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 API URL: http://localhost:${PORT}`);
});