const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    shortDescription: {
        type: String,
        required: true
    },
    price: {
        single: {
            type: Number,
            required: true
        },
        packages: [{
            sessions: Number,
            price: Number,
            savings: Number
        }]
    },
    duration: {
        type: Number, // en minutes
        required: true,
        default: 60
    },
    category: {
        type: String,
        enum: ['hydrafacial', 'microneedling', 'led', 'bbglow', 'combiné'],
        required: true
    },
    benefits: [String],
    contraindications: [String],
    preparationAdvice: [String],
    aftercareAdvice: [String],
    images: [String],
    isActive: {
        type: Boolean,
        default: true
    },
    order: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Service', serviceSchema);