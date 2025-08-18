const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    phone: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['client', 'admin'],
        default: 'client'
    },
    dateOfBirth: {
        type: Date
    },
    address: {
        street: String,
        city: String,
        postalCode: String
    },
    skinType: {
        type: String,
        enum: ['normale', 'sèche', 'grasse', 'mixte', 'sensible'],
        default: 'normale'
    },
    allergies: [String],
    notes: String,
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date
    },
    resetPasswordToken: {
        type: String
    },
    resetPasswordExpires: {
        type: Date
    }
}, {
    timestamps: true
});

// Hash du mot de passe avant sauvegarde
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Méthode pour comparer les mots de passe
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Méthode pour obtenir les infos publiques
userSchema.methods.toJSON = function() {
    const user = this.toObject();
    delete user.password;
    delete user.resetPasswordToken;
    delete user.resetPasswordExpires;
    return user;
};

// Générer un token de réinitialisation de mot de passe
userSchema.methods.generateResetPasswordToken = function() {
    const crypto = require('crypto');
    
    // Générer un token aléatoire
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Hasher le token et le stocker
    this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    // Définir l'expiration (10 minutes)
    this.resetPasswordExpires = Date.now() + 10 * 60 * 1000;
    
    return resetToken;
};

module.exports = mongoose.model('User', userSchema);