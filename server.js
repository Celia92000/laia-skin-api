const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Stockage temporaire en mémoire (sera perdu au redémarrage)
let appointments = [];

// Middleware
app.use(cors({
    origin: ['https://celia92000.github.io', 'http://localhost:3000', 'http://localhost:3001'],
    credentials: true
}));
app.use(express.json());

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://celiaivorra95:etTlRYMlQattYIgV9A@cluster0.t3fu9bb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

// Schéma MongoDB pour les rendez-vous
const appointmentSchema = new mongoose.Schema({
    service: { type: String, required: true },
    clientName: { type: String, required: true },
    email: String,
    phone: String,
    date: String,
    time: String,
    datetime: String,
    price: Number,
    duration: Number,
    status: { type: String, default: 'confirmé' },
    notes: String,
    createdAt: { type: Date, default: Date.now },
    client: {
        name: String,
        email: String,
        phone: String
    }
});

const Appointment = mongoose.model('Appointment', appointmentSchema);

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

// Get all appointments
app.get('/api/appointments', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            // Si MongoDB est connecté, utiliser la base de données
            const dbAppointments = await Appointment.find().sort({ createdAt: -1 });
            res.json({ appointments: dbAppointments });
        } else {
            // Sinon, utiliser le stockage en mémoire
            res.json({ appointments });
        }
    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.json({ appointments });
    }
});

// Create appointment
app.post('/api/appointments', async (req, res) => {
    try {
        const appointmentData = {
            ...req.body,
            datetime: req.body.datetime || `${req.body.date}T${req.body.time}:00`,
            client: {
                name: req.body.clientName || req.body.name,
                email: req.body.email || req.body.clientEmail,
                phone: req.body.phone || req.body.clientPhone
            }
        };

        let newAppointment;

        if (mongoose.connection.readyState === 1) {
            // Si MongoDB est connecté, sauvegarder dans la base
            try {
                const appointment = new Appointment(appointmentData);
                newAppointment = await appointment.save();
                console.log('✅ Appointment saved to MongoDB:', newAppointment._id);
            } catch (dbError) {
                console.error('MongoDB save error:', dbError);
                // Fallback: créer sans MongoDB
                newAppointment = {
                    _id: `apt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    ...appointmentData,
                    createdAt: new Date().toISOString(),
                    status: appointmentData.status || 'confirmé'
                };
                appointments.push(newAppointment);
            }
        } else {
            // MongoDB non connecté, utiliser le stockage en mémoire
            newAppointment = {
                _id: `apt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                ...appointmentData,
                createdAt: new Date().toISOString(),
                status: appointmentData.status || 'confirmé'
            };
            appointments.push(newAppointment);
        }
        
        res.status(201).json(newAppointment);
    } catch (error) {
        console.error('Error creating appointment:', error);
        res.status(500).json({ error: error.message });
    }
});

// Admin appointments route
app.get('/api/admin/appointments', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            const dbAppointments = await Appointment.find().sort({ createdAt: -1 });
            res.json({ appointments: dbAppointments });
        } else {
            res.json({ appointments });
        }
    } catch (error) {
        console.error('Error fetching admin appointments:', error);
        res.json({ appointments });
    }
});

// Update appointment
app.patch('/api/appointments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        if (mongoose.connection.readyState === 1) {
            const updated = await Appointment.findByIdAndUpdate(id, req.body, { new: true });
            res.json(updated);
        } else {
            const index = appointments.findIndex(a => a._id === id);
            if (index !== -1) {
                appointments[index] = { ...appointments[index], ...req.body };
                res.json(appointments[index]);
            } else {
                res.status(404).json({ error: 'Appointment not found' });
            }
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete appointment
app.delete('/api/appointments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        if (mongoose.connection.readyState === 1) {
            await Appointment.findByIdAndDelete(id);
            res.json({ message: 'Appointment deleted' });
        } else {
            appointments = appointments.filter(a => a._id !== id);
            res.json({ message: 'Appointment deleted' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Occupied slots route
app.get('/api/appointments/occupied-slots', async (req, res) => {
    try {
        let occupiedSlots = [];
        
        if (mongoose.connection.readyState === 1) {
            const dbAppointments = await Appointment.find({ status: { $ne: 'annulé' } });
            occupiedSlots = dbAppointments.map(apt => ({
                datetime: apt.datetime,
                duration: apt.duration || 60
            }));
        } else {
            occupiedSlots = appointments
                .filter(apt => apt.status !== 'annulé')
                .map(apt => ({
                    datetime: apt.datetime,
                    duration: apt.duration || 60
                }));
        }
        
        res.json({ occupiedSlots });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Services endpoint
app.get('/api/admin/services', (req, res) => {
    const services = [
        { name: 'BB Glow', price: 100, duration: 90 },
        { name: 'LED Thérapie', price: 40, duration: 30 },
        { name: 'Hydro Cleaning', price: 90, duration: 90 },
        { name: 'LAIA Renaissance', price: 70, duration: 75 },
        { name: 'Éclat Suprême', price: 120, duration: 90 }
    ];
    res.json({ services });
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
    console.log(`💾 MongoDB: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Not connected'}`);
});
