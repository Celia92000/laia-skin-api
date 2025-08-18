const mongoose = require('mongoose');

const loyaltySchema = new mongoose.Schema({
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    soinsCount: {
        type: Number,
        default: 0,
        min: 0
    },
    forfaitsCount: {
        type: Number,
        default: 0,
        min: 0
    },
    discountEarned10: {
        type: Number,
        default: 0,
        min: 0
    },
    discountEarned20: {
        type: Number,
        default: 0,
        min: 0
    },
    totalVisits: {
        type: Number,
        default: 0,
        min: 0
    },
    lastActivity: {
        type: Date,
        default: Date.now
    },
    history: [{
        date: {
            type: Date,
            default: Date.now
        },
        action: {
            type: String,
            enum: ['soin_completed', 'forfait_completed', 'discount_earned', 'discount_used', 'exceptional_discount'],
            required: true
        },
        service: String,
        appointmentType: {
            type: String,
            enum: ['soin', 'forfait']
        },
        amount: Number, // Montant pour les remises
        reason: String, // Raison pour remises exceptionnelles
        notes: String
    }],
    // Suivi des remises utilisées
    discountsUsed: [{
        date: {
            type: Date,
            default: Date.now
        },
        amount: Number,
        appointmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Appointment'
        },
        notes: String
    }]
}, {
    timestamps: true
});

// Méthode pour ajouter un soin/forfait et calculer les remises
loyaltySchema.methods.addService = function(serviceType, serviceName) {
    this.totalVisits += 1;
    this.lastActivity = new Date();
    
    // Ajouter à l'historique
    this.history.push({
        action: `${serviceType}_completed`,
        service: serviceName,
        appointmentType: serviceType
    });
    
    if (serviceType === 'soin') {
        this.soinsCount += 1;
        
        // Vérifier si on a atteint 5 soins = 1 remise -10€
        if (this.soinsCount >= 5) {
            const newDiscounts = Math.floor(this.soinsCount / 5);
            const currentDiscounts = this.discountEarned10;
            
            if (newDiscounts > currentDiscounts) {
                this.discountEarned10 = newDiscounts;
                
                // Ajouter à l'historique
                this.history.push({
                    action: 'discount_earned',
                    amount: 10,
                    notes: `Remise -10€ gagnée (${this.soinsCount} soins)`
                });
            }
        }
    } else if (serviceType === 'forfait') {
        this.forfaitsCount += 1;
        
        // Vérifier si on a atteint 2 forfaits = 1 remise -20€
        if (this.forfaitsCount >= 2) {
            const newDiscounts = Math.floor(this.forfaitsCount / 2);
            const currentDiscounts = this.discountEarned20;
            
            if (newDiscounts > currentDiscounts) {
                this.discountEarned20 = newDiscounts;
                
                // Ajouter à l'historique
                this.history.push({
                    action: 'discount_earned',
                    amount: 20,
                    notes: `Remise -20€ gagnée (${this.forfaitsCount} forfaits)`
                });
            }
        }
    }
    
    return this.save();
};

// Méthode pour utiliser une remise
loyaltySchema.methods.useDiscount = function(amount, appointmentId, notes = '') {
    if (amount === 10 && this.discountEarned10 > 0) {
        this.discountEarned10 -= 1;
    } else if (amount === 20 && this.discountEarned20 > 0) {
        this.discountEarned20 -= 1;
    } else {
        throw new Error('Remise non disponible');
    }
    
    // Ajouter aux remises utilisées
    this.discountsUsed.push({
        amount: amount,
        appointmentId: appointmentId,
        notes: notes
    });
    
    // Ajouter à l'historique
    this.history.push({
        action: 'discount_used',
        amount: amount,
        notes: notes || `Remise -${amount}€ utilisée`
    });
    
    return this.save();
};

// Méthode pour donner une remise exceptionnelle
loyaltySchema.methods.giveExceptionalDiscount = function(amount, reason, notes = '') {
    if (amount === 10) {
        this.discountEarned10 += 1;
    } else if (amount === 20) {
        this.discountEarned20 += 1;
    } else {
        throw new Error('Montant de remise invalide');
    }
    
    // Ajouter à l'historique
    this.history.push({
        action: 'exceptional_discount',
        amount: amount,
        reason: reason,
        notes: notes
    });
    
    return this.save();
};

// Méthode pour vérifier si les remises sont expirées (12 mois d'inactivité)
loyaltySchema.methods.checkExpiration = function() {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    return this.lastActivity < twelveMonthsAgo;
};

// Index pour optimiser les requêtes
loyaltySchema.index({ client: 1 });
loyaltySchema.index({ lastActivity: 1 });

module.exports = mongoose.model('Loyalty', loyaltySchema);
