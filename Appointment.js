const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    service: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        required: true
    },
    datetime: {
        type: Date,
        required: true
    },
    duration: {
        type: Number, // en minutes
        required: true,
        default: 60
    },
    status: {
        type: String,
        enum: ['confirmé', 'en_attente', 'annulé', 'terminé', 'no_show'],
        default: 'en_attente'
    },
    paymentStatus: {
        type: String,
        enum: ['en_attente', 'acompte_payé', 'payé_intégralement', 'remboursé'],
        default: 'en_attente'
    },
    pricing: {
        servicePrice: Number,
        deposit: {
            type: Number,
            default: 30
        },
        remainingAmount: Number,
        totalPaid: {
            type: Number,
            default: 0
        }
    },
    packageInfo: {
        isPackage: {
            type: Boolean,
            default: false
        },
        packageId: String,
        sessionNumber: Number,
        totalSessions: Number
    },
    notes: {
        client: String,
        admin: String,
        aftercare: String
    },
    skinAnalysis: {
        skinType: String,
        concerns: [String],
        sensitivity: String,
        previousTreatments: String
    },
    reminders: {
        emailSent: {
            type: Boolean,
            default: false
        },
        smsSent: {
            type: Boolean,
            default: false
        },
        reminderDate: Date
    },
    createdBy: {
        type: String,
        enum: ['client', 'admin'],
        default: 'client'
    }
}, {
    timestamps: true
});

// Index pour optimiser les recherches
appointmentSchema.index({ datetime: 1 });
appointmentSchema.index({ client: 1 });
appointmentSchema.index({ status: 1 });

// Middleware pour calculer le montant restant
appointmentSchema.pre('save', function(next) {
    if (this.pricing.servicePrice && this.pricing.deposit) {
        this.pricing.remainingAmount = this.pricing.servicePrice - this.pricing.totalPaid;
    }
    next();
});

module.exports = mongoose.model('Appointment', appointmentSchema);