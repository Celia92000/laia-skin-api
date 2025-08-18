const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
require('dotenv').config();

// JWT Secret pour les tokens
const JWT_SECRET = process.env.JWT_SECRET || 'laia_skin_secret_key_2025';

// Configuration du transporteur email
const emailTransporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.live.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER || 'votre-email@hotmail.fr',
        pass: process.env.EMAIL_PASS || 'votre-mot-de-passe-app'
    }
});

// Configuration WhatsApp Business API
const WHATSAPP_CONFIG = {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || 'YOUR_PHONE_NUMBER_ID',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || 'YOUR_ACCESS_TOKEN',
    apiVersion: 'v18.0',
    baseUrl: 'https://graph.facebook.com'
};

// Fonction pour envoyer un message WhatsApp
async function sendWhatsAppMessage(to, templateName, templateParams = []) {
    try {
        const url = `${WHATSAPP_CONFIG.baseUrl}/${WHATSAPP_CONFIG.apiVersion}/${WHATSAPP_CONFIG.phoneNumberId}/messages`;
        
        const payload = {
            messaging_product: "whatsapp",
            to: to.replace(/\D/g, ''), // Supprimer tous les caractères non numériques
            type: "template",
            template: {
                name: templateName,
                language: {
                    code: "fr"
                },
                components: templateParams.length > 0 ? [{
                    type: "body",
                    parameters: templateParams.map(param => ({
                        type: "text",
                        text: param
                    }))
                }] : []
            }
        };

        const response = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${WHATSAPP_CONFIG.accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ WhatsApp envoyé:', response.data);
        return { success: true, messageId: response.data.messages[0].id };

    } catch (error) {
        console.error('❌ Erreur WhatsApp:', error.response?.data || error.message);
        return { success: false, error: error.response?.data || error.message };
    }
}

// Fonction pour envoyer un message WhatsApp simple (pour tests)
async function sendWhatsAppText(to, text) {
    try {
        const url = `${WHATSAPP_CONFIG.baseUrl}/${WHATSAPP_CONFIG.apiVersion}/${WHATSAPP_CONFIG.phoneNumberId}/messages`;
        
        const payload = {
            messaging_product: "whatsapp",
            to: to.replace(/\D/g, ''),
            type: "text",
            text: {
                body: text
            }
        };

        const response = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${WHATSAPP_CONFIG.accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ WhatsApp texte envoyé:', response.data);
        return { success: true, messageId: response.data.messages[0].id };

    } catch (error) {
        console.error('❌ Erreur WhatsApp texte:', error.response?.data || error.message);
        return { success: false, error: error.response?.data || error.message };
    }
}

// Fonction pour envoyer l'email de confirmation
// Fonction utilitaire pour obtenir l'emoji du service
function getServiceEmoji(serviceCategory) {
    const serviceEmojis = {
        hydronaissance: '🌟',
        bb_glow: '✨', 
        hydro_cleaning: '💧',
        microneedling: '🔄',
        led_therapie: '💡'
    };
    return serviceEmojis[serviceCategory] || '🌟';
}

async function sendConfirmationEmail(booking, appointment, isNewAccount = false) {
    try {
        const appointmentDate = new Date(appointment.datetime);
        const formattedDate = appointmentDate.toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const formattedTime = appointmentDate.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const emailHtml = `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Confirmation de réservation - LAIA SKIN INSTITUT</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=Lora:wght@400;500&display=swap');
                
                body {
                    font-family: 'Lora', serif;
                    line-height: 1.6;
                    color: #2c3e50;
                    background: linear-gradient(135deg, #fdfbf7, #f8f6f0);
                    margin: 0;
                    padding: 20px;
                }
                
                .email-container {
                    max-width: 600px;
                    margin: 0 auto;
                    background: white;
                    border-radius: 20px;
                    overflow: hidden;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.1);
                }
                
                .header {
                    background: linear-gradient(135deg, #d4b5a0, #c9a084);
                    color: white;
                    padding: 2rem;
                    text-align: center;
                }
                
                .header h1 {
                    font-family: 'Playfair Display', serif;
                    font-size: 2rem;
                    margin: 0;
                    text-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
                
                .content {
                    padding: 2rem;
                }
                
                .greeting {
                    font-size: 1.1rem;
                    margin-bottom: 1.5rem;
                    color: #c9a084;
                    font-weight: 500;
                }
                
                .appointment-details {
                    background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,248,220,0.8));
                    border: 2px solid rgba(212, 181, 160, 0.3);
                    border-radius: 15px;
                    padding: 1.5rem;
                    margin: 1.5rem 0;
                }
                
                .detail-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 0.8rem;
                    padding-bottom: 0.5rem;
                    border-bottom: 1px solid rgba(212, 181, 160, 0.2);
                }
                
                .detail-row:last-child {
                    border-bottom: none;
                    margin-bottom: 0;
                    font-weight: bold;
                }
                
                .detail-label {
                    color: #5a6c7d;
                    font-weight: 500;
                }
                
                .detail-value {
                    color: #2c3e50;
                    font-weight: 600;
                }
                
                .login-info {
                    background: rgba(40, 167, 69, 0.1);
                    border: 2px solid rgba(40, 167, 69, 0.2);
                    border-radius: 15px;
                    padding: 1.5rem;
                    margin: 1.5rem 0;
                }
                
                .login-info h3 {
                    color: #28a745;
                    margin-top: 0;
                    font-family: 'Playfair Display', serif;
                }
                
                .credentials {
                    background: rgba(255,255,255,0.8);
                    padding: 1rem;
                    border-radius: 10px;
                    margin: 1rem 0;
                    border-left: 4px solid #28a745;
                }
                
                .btn {
                    display: inline-block;
                    background: linear-gradient(135deg, #D4AF37, #B8860B, #DAA520);
                    color: white;
                    padding: 1rem 2rem;
                    text-decoration: none;
                    border-radius: 25px;
                    font-weight: 500;
                    text-align: center;
                    margin: 1rem 0;
                    box-shadow: 0 8px 25px rgba(212, 175, 55, 0.4);
                }
                
                .important-notes {
                    background: rgba(255, 193, 7, 0.1);
                    border: 2px solid rgba(255, 193, 7, 0.3);
                    border-radius: 15px;
                    padding: 1.5rem;
                    margin: 1.5rem 0;
                }
                
                .footer {
                    background: #f8f9fa;
                    padding: 1.5rem;
                    text-align: center;
                    color: #666;
                    font-size: 0.9rem;
                    border-top: 1px solid #e9ecef;
                }
                
                .contact-info {
                    margin-top: 1rem;
                }
                
                @media (max-width: 600px) {
                    .detail-row {
                        flex-direction: column;
                        text-align: center;
                    }
                    .detail-label {
                        margin-bottom: 0.3rem;
                    }
                }
            </style>
        </head>
        <body>
            <div class="email-container">
                <div class="header">
                    <h1>🌸 LAIA SKIN INSTITUT 🌸</h1>
                    <p>Votre réservation est confirmée</p>
                </div>
                
                <div class="content">
                    <div class="greeting">
                        Bonjour ${booking.firstName} ${booking.lastName},
                    </div>
                    
                    <p>Nous avons le plaisir de confirmer votre réservation. Votre acompte de 60€ a été traité avec succès.</p>
                    
                    <div class="appointment-details">
                        <div class="detail-row">
                            <span class="detail-label">Service :</span>
                            <span class="detail-value">${getServiceEmoji(appointment.service.category)} ${appointment.service.name}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Date :</span>
                            <span class="detail-value">${formattedDate}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Heure :</span>
                            <span class="detail-value">${formattedTime}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Durée :</span>
                            <span class="detail-value">${appointment.service.duration} minutes</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Prix total :</span>
                            <span class="detail-value">${appointment.pricing.servicePrice}€</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Paiement :</span>
                            <span class="detail-value">${appointment.pricing.servicePrice}€ en espèces le jour J</span>
                        </div>
                    </div>
                    
                    ${isNewAccount ? `
                    <div class="login-info">
                        <h3>🔑 Vos identifiants de connexion</h3>
                        <p>Votre compte client a été créé avec succès ! Vous pouvez maintenant accéder à votre espace personnel pour suivre vos rendez-vous :</p>
                        
                        <div class="credentials">
                            <strong>Email :</strong> ${booking.email}<br>
                            <strong>Mot de passe :</strong> ${booking.password}
                        </div>
                        
                        <a href="http://localhost:3001/espace-client.html" class="btn">
                            🔑 Accéder à votre espace client
                        </a>
                        
                        <p><small>⚠️ Conservez précieusement ces identifiants. Nous vous recommandons de changer votre mot de passe lors de votre première connexion.</small></p>
                    </div>
                    ` : `
                    <div class="login-info">
                        <h3>🔑 Votre espace client</h3>
                        <p>Connectez-vous à votre espace client pour suivre vos rendez-vous :</p>
                        <a href="http://localhost:3001/espace-client.html" class="btn">
                            🔑 Accéder à votre espace client
                        </a>
                    </div>
                    `}
                    
                    <div class="important-notes">
                        <h3>📋 Informations importantes</h3>
                        <ul>
                            <li><strong>💰 Paiement :</strong> Apportez 120€ en espèces le jour du rendez-vous (prévoir l'appoint)</li>
                            <li><strong>📧📱 Confirmation obligatoire :</strong> Nous vous contacterons par email et WhatsApp 24h avant pour confirmation</li>
                            <li><strong>⏰ Annulation :</strong> Possible jusqu'à 48h avant le rendez-vous</li>
                            <li><strong>🕐 Retard :</strong> Au-delà de 15 minutes, le soin pourra être écourté</li>
                            <li><strong>☀️ Préparation :</strong> Évitez l'exposition au soleil 48h avant votre soin</li>
                        </ul>
                    </div>
                    
                    <div style="background: rgba(212, 181, 160, 0.1); padding: 1.5rem; border-radius: 15px; margin: 1.5rem 0; text-align: center;">
                        <h3 style="color: #c9a084; margin-bottom: 1rem;">🔧 Gérer votre rendez-vous</h3>
                        <p style="margin-bottom: 1.5rem; font-size: 0.95rem;">Besoin de modifier ou annuler votre rendez-vous ?</p>
                        <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                            <a href="http://localhost:3000/confirm-appointment?id=${appointment._id}&action=reschedule" style="background: #fd7e14; color: white; padding: 0.8rem 1.5rem; border-radius: 20px; text-decoration: none; font-weight: 500; display: flex; align-items: center; gap: 0.5rem; transition: all 0.3s ease;">
                                📅 Reporter mon RDV
                            </a>
                            <a href="http://localhost:3000/confirm-appointment?id=${appointment._id}&action=cancel" style="background: #dc3545; color: white; padding: 0.8rem 1.5rem; border-radius: 20px; text-decoration: none; font-weight: 500; display: flex; align-items: center; gap: 0.5rem; transition: all 0.3s ease;">
                                ❌ Annuler mon RDV
                            </a>
                        </div>
                        <p style="margin-top: 1rem; font-size: 0.8rem; color: #666;">Ces liens restent actifs jusqu'à 48h avant votre rendez-vous</p>
                    </div>
                    
                    <p>Nous avons hâte de vous accueillir dans notre institut pour ce moment de détente et de beauté.</p>
                    
                    <p style="margin-top: 2rem;">
                        Bien à vous,<br>
                        <strong>L'équipe LAIA SKIN INSTITUT</strong>
                    </p>
                </div>
                
                <div class="footer">
                    <div class="contact-info">
                        <strong>LAIA SKIN INSTITUT</strong><br>
                        📍 [Votre adresse]<br>
                        📞 [Votre téléphone]<br>
                        📧 contact@laiaskin.com<br>
                        🌐 www.laiaskin.com
                    </div>
                    
                    <p style="margin-top: 1rem;">
                        Cet email a été envoyé automatiquement, merci de ne pas y répondre.<br>
                        Pour toute question, contactez-nous directement.
                    </p>
                </div>
            </div>
        </body>
        </html>
        `;

        const mailOptions = {
            from: `"LAIA SKIN INSTITUT" <${process.env.EMAIL_USER || 'noreply@laiaskin.com'}>`,
            to: booking.email,
            subject: `✅ Réservation confirmée - ${formattedDate} à ${formattedTime}`,
            html: emailHtml,
            text: `
Bonjour ${booking.firstName} ${booking.lastName},

Votre réservation est confirmée !

Service: ${getServiceEmoji(appointment.service.category)} ${appointment.service.name}
Date: ${formattedDate}
Heure: ${formattedTime}
Durée: ${appointment.service.duration} minutes
Prix total: ${appointment.pricing.servicePrice}€
Paiement: ${appointment.pricing.servicePrice}€ en espèces le jour J

${isNewAccount ? `
VOS IDENTIFIANTS DE CONNEXION:
Email: ${booking.email}
Mot de passe: ${booking.password}
Accédez à votre espace: http://localhost:3001/espace-client.html
` : ''}

INFORMATIONS IMPORTANTES:
- 💰 PAIEMENT: Apportez 120€ en espèces le jour du rendez-vous (prévoir l'appoint)
- 📧📱 CONFIRMATION: Nous vous contacterons par email et WhatsApp 24h avant
- ⏰ Annulation possible jusqu'à 48h avant
- ☀️ Évitez l'exposition au soleil 48h avant votre soin

Merci de votre confiance,
L'équipe LAIA SKIN INSTITUT
            `
        };

        const info = await emailTransporter.sendMail(mailOptions);
        console.log('✅ Email de confirmation envoyé:', info.messageId);
        return true;

    } catch (error) {
        console.error('❌ Erreur envoi email:', error);
        return false;
    }
}

// Fonction pour envoyer un rappel 24h avant
async function sendReminderEmail(appointment, user) {
    try {
        const appointmentDate = new Date(appointment.datetime);
        const formattedDate = appointmentDate.toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const formattedTime = appointmentDate.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const emailHtml = `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Rappel rendez-vous - LAIA SKIN INSTITUT</title>
            <style>
                body { font-family: 'Lora', serif; line-height: 1.6; color: #2c3e50; background: #fdfbf7; margin: 0; padding: 20px; }
                .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 20px; padding: 2rem; box-shadow: 0 20px 60px rgba(0,0,0,0.1); }
                .header { background: linear-gradient(135deg, #d4b5a0, #c9a084); color: white; padding: 1.5rem; text-align: center; border-radius: 15px; margin-bottom: 2rem; }
                .appointment-info { background: rgba(255, 193, 7, 0.1); padding: 1.5rem; border-radius: 15px; margin: 1rem 0; text-align: center; }
                .confirm-buttons { text-align: center; margin: 2rem 0; }
                .btn { display: inline-block; padding: 1rem 2rem; margin: 0.5rem; border-radius: 25px; text-decoration: none; font-weight: bold; }
                .btn-confirm { background: #28a745; color: white; }
                .btn-cancel { background: #dc3545; color: white; }
                .payment-reminder { background: rgba(40, 167, 69, 0.1); padding: 1.5rem; border-radius: 15px; margin: 1rem 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🌸 LAIA SKIN INSTITUT 🌸</h1>
                    <p>Rappel de votre rendez-vous demain</p>
                </div>
                
                <p>Bonjour ${user.name},</p>
                
                <p>Nous vous rappelons votre rendez-vous prévu <strong>demain</strong> :</p>
                
                <div class="appointment-info">
                    <h3>${getServiceEmoji(appointment.service.category)} ${appointment.service.name}</h3>
                    <p><strong>📅 ${formattedDate}</strong></p>
                    <p><strong>🕐 ${formattedTime}</strong></p>
                    <p><strong>⏱️ Durée : ${appointment.service.duration} minutes</strong></p>
                </div>
                
                <div class="payment-reminder">
                    <p><strong>💰 N'oubliez pas :</strong> Apportez ${appointment.pricing.servicePrice}€ en espèces (prévoir l'appoint)</p>
                </div>
                
                <div class="confirm-buttons">
                    <h3>⚠️ CONFIRMATION OBLIGATOIRE ⚠️</h3>
                    <p>Merci de confirmer votre présence en cliquant sur l'un des boutons :</p>
                    <a href="http://localhost:3000/confirm-appointment?id=${appointment._id}&action=confirm" class="btn btn-confirm">
                        ✅ Je confirme ma présence
                    </a>
                    <a href="http://localhost:3000/confirm-appointment?id=${appointment._id}&action=reschedule" class="btn btn-reschedule" style="background: #fd7e14; color: white;">
                        📅 Reporter mon RDV
                    </a>
                    <a href="http://localhost:3000/confirm-appointment?id=${appointment._id}&action=cancel" class="btn btn-cancel">
                        ❌ J'annule mon RDV
                    </a>
                </div>
                
                <p style="margin-top: 2rem; font-size: 0.9rem; color: #666;">
                    <strong>Important :</strong> Sans confirmation, votre créneau pourra être libéré pour d'autres clients.
                </p>
                
                <p style="margin-top: 2rem;">
                    À très bientôt,<br>
                    <strong>L'équipe LAIA SKIN INSTITUT</strong>
                </p>
            </div>
        </body>
        </html>
        `;

        const mailOptions = {
            from: `"LAIA SKIN INSTITUT" <${process.env.EMAIL_USER || 'noreply@laiaskin.com'}>`,
            to: user.email,
            subject: `⏰ Rappel : RDV demain ${formattedTime} - Confirmation requise`,
            html: emailHtml,
            text: `
Rappel rendez-vous demain - LAIA SKIN INSTITUT

Bonjour ${user.name},

Votre rendez-vous ${appointment.service.name} est prévu demain :
📅 ${formattedDate}
🕐 ${formattedTime}
⏱️ Durée : ${appointment.service.duration} minutes

💰 N'oubliez pas : ${appointment.pricing.servicePrice}€ en espèces (prévoir l'appoint)

⚠️ CONFIRMATION OBLIGATOIRE
Répondez à ce message pour confirmer votre présence.
Sans confirmation, le créneau pourra être libéré.

À très bientôt,
L'équipe LAIA SKIN INSTITUT
            `
        };

        const info = await emailTransporter.sendMail(mailOptions);
        console.log('✅ Email de rappel envoyé:', info.messageId);
        return true;

    } catch (error) {
        console.error('❌ Erreur envoi rappel email:', error);
        return false;
    }
}

// Fonction pour envoyer un rappel WhatsApp
async function sendWhatsAppReminder(appointment, user) {
    try {
        const appointmentDate = new Date(appointment.datetime);
        const formattedDate = appointmentDate.toLocaleDateString('fr-FR');
        const formattedTime = appointmentDate.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Utiliser le template approuvé par Meta (à créer)
        const templateName = 'rappel_rdv_laia_skin';
        const templateParams = [
            user.name, // {{1}}
            formattedDate, // {{2}}
            formattedTime, // {{3}}
            'Hydro\'Naissance', // {{4}}
            '120€' // {{5}}
        ];

        const result = await sendWhatsAppMessage(user.phone, templateName, templateParams);
        
        if (result.success) {
            console.log(`✅ WhatsApp rappel envoyé à ${user.name}: ${result.messageId}`);
        } else {
            console.error(`❌ Échec WhatsApp rappel pour ${user.name}:`, result.error);
        }

        return result;

    } catch (error) {
        console.error('❌ Erreur fonction WhatsApp rappel:', error);
        return { success: false, error: error.message };
    }
}

// Fonction pour programmer le rappel automatique
function scheduleReminder(appointment, user) {
    const appointmentDate = new Date(appointment.datetime);
    const reminderDate = new Date(appointmentDate.getTime() - 24 * 60 * 60 * 1000); // 24h avant
    const now = new Date();
    
    if (reminderDate > now) {
        const delay = reminderDate.getTime() - now.getTime();
        
        setTimeout(async () => {
            console.log(`⏰ Envoi rappel pour RDV ${appointment._id}`);
            
            // Envoyer l'email de rappel
            await sendReminderEmail(appointment, user);
            
            // Envoyer le WhatsApp de rappel
            await sendWhatsAppReminder(appointment, user);
            
        }, delay);
        
        console.log(`⏰ Rappel programmé pour ${reminderDate.toLocaleString('fr-FR')}`);
    }
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// === CONNEXION MONGODB ===
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    console.log('✅ Connecté à MongoDB Atlas');
})
.catch((error) => {
    console.error('❌ Erreur de connexion MongoDB:', error);
});

// === MODÈLES ===
const Loyalty = require('./models/Loyalty');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String },
    role: { type: String, enum: ['client', 'admin'], default: 'client' },
    skinType: { type: String },
    allergies: [String],
    createdAt: { type: Date, default: Date.now }
});

const appointmentSchema = new mongoose.Schema({
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    datetime: { type: Date, required: true },
    duration: { type: Number, required: true }, // en minutes
    status: { type: String, enum: ['confirmé', 'en_attente', 'annulé', 'terminé'], default: 'confirmé' },
    service: {
        name: { type: String, required: true },
        category: { type: String, required: true },
        duration: { type: Number, required: true }
    },
    paymentStatus: { type: String, enum: ['non_payé', 'acompte_payé', 'payé'], default: 'non_payé' },
    pricing: {
        servicePrice: { type: Number, required: true },
        deposit: { type: Number, default: 0 },
        totalPaid: { type: Number, default: 0 }
    },
    notes: {
        client: { type: String, default: '' },
        admin: { type: String, default: '' }
    },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Appointment = mongoose.model('Appointment', appointmentSchema);

// Schéma pour les notifications admin en temps réel
const adminNotificationSchema = new mongoose.Schema({
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
    action: { type: String, enum: ['confirm', 'cancel', 'reschedule'], required: true },
    clientName: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    read: { type: Boolean, default: false }
});

const AdminNotification = mongoose.model('AdminNotification', adminNotificationSchema);

// Schéma pour les services
const serviceSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true }, // ex: "led_therapie"
    name: { type: String, required: true }, // ex: "💡 LED Thérapie"
    description: { type: String, required: true },
    price: { type: Number, required: true },
    duration: { type: Number, required: true }, // en minutes
    preparationTime: { type: Number, default: 15 }, // temps de préparation
    totalDuration: { type: Number }, // calculé automatiquement
    emoji: { type: String, default: '✨' },
    label: { type: String, required: true },
    active: { type: Boolean, default: true },
    category: { type: String, default: 'soin' },
    order: { type: Number, default: 0 }, // pour l'ordre d'affichage
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Middleware pour calculer totalDuration automatiquement
serviceSchema.pre('save', function(next) {
    this.totalDuration = this.duration + this.preparationTime;
    this.updatedAt = new Date();
    next();
});

const Service = mongoose.model('Service', serviceSchema);

// Schéma pour la gestion du contenu du site
const siteContentSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true }, // identifiant unique (ex: hero_title)
    value: { type: String, required: true }, // contenu (texte)
    type: { type: String, enum: ['text', 'html', 'image'], default: 'text' },
    section: { type: String, required: true }, // section du site (hero, services, contact, etc.)
    description: { type: String }, // description pour l'admin
    updatedAt: { type: Date, default: Date.now }
});

siteContentSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

const SiteContent = mongoose.model('SiteContent', siteContentSchema);

// === ROUTES AUTH ===
// Route pour vérifier si un email existe
app.post('/api/auth/check-email', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email requis' });
        }
        
        const user = await User.findOne({ email: email.toLowerCase() });
        
        res.json({
            exists: !!user,
            email: email.toLowerCase()
        });
    } catch (error) {
        console.error('Erreur vérification email:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(`🔐 Tentative connexion: ${email}`);
        
        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (user && await bcrypt.compare(password, user.password)) {
            console.log(`✅ Connexion réussie: ${user.name}`);
            
            // Générer un vrai token JWT
            const token = jwt.sign(
                { userId: user._id, email: user.email, role: user.role },
                JWT_SECRET,
                { expiresIn: '24h' }
            );
            
            res.json({
                message: 'Connexion réussie',
                token: token,
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: user.role,
                    createdAt: user.createdAt
                }
            });
        } else {
            console.log(`❌ Échec connexion: ${email}`);
            res.status(401).json({ 
                message: 'Email ou mot de passe incorrect' 
            });
        }
    } catch (error) {
        console.error('Erreur login:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

app.get('/api/auth/verify', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        console.log(`🔐 Vérification token: ${token ? token.substring(0, 20) + '...' : 'aucun'}`);
        
        if (token && token.startsWith('token_')) {
            const userId = token.split('_')[1];
            const user = await User.findById(userId);
            
            if (user) {
                res.json({
                    valid: true,
                    user: {
                        _id: user._id,
                        name: user.name,
                        email: user.email,
                        role: user.role
                    }
                });
            } else {
                res.status(401).json({ valid: false });
            }
        } else {
            res.status(401).json({ valid: false });
        }
    } catch (error) {
        console.error('Erreur vérification token:', error);
        res.status(500).json({ valid: false });
    }
});

// === ROUTES SERVICES ===
// Récupérer tous les services
app.get('/api/services', async (req, res) => {
    try {
        const services = await Service.find({ active: true }).sort({ order: 1 });
        res.json(services);
    } catch (error) {
        console.error('Erreur récupération services:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Récupérer tous les services (admin)
app.get('/api/admin/services', async (req, res) => {
    try {
        const services = await Service.find().sort({ order: 1 });
        res.json(services);
    } catch (error) {
        console.error('Erreur récupération services admin:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Créer un nouveau service
app.post('/api/admin/services', async (req, res) => {
    try {
        const serviceData = req.body;
        const newService = new Service(serviceData);
        await newService.save();
        
        console.log('✅ Nouveau service créé:', newService.name);
        res.json(newService);
    } catch (error) {
        console.error('Erreur création service:', error);
        res.status(500).json({ error: 'Erreur création service', details: error.message });
    }
});

// Modifier un service
app.put('/api/admin/services/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        const service = await Service.findByIdAndUpdate(id, updateData, { new: true });
        
        if (!service) {
            return res.status(404).json({ error: 'Service non trouvé' });
        }
        
        console.log('✅ Service modifié:', service.name);
        res.json(service);
    } catch (error) {
        console.error('Erreur modification service:', error);
        res.status(500).json({ error: 'Erreur modification service', details: error.message });
    }
});

// Supprimer un service
app.delete('/api/admin/services/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const service = await Service.findByIdAndDelete(id);
        
        if (!service) {
            return res.status(404).json({ error: 'Service non trouvé' });
        }
        
        console.log('✅ Service supprimé:', service.name);
        res.json({ message: 'Service supprimé avec succès' });
    } catch (error) {
        console.error('Erreur suppression service:', error);
        res.status(500).json({ error: 'Erreur suppression service', details: error.message });
    }
});

// === ROUTES GESTION CONTENU SITE ===

// Obtenir tout le contenu du site
app.get('/api/admin/site-content', async (req, res) => {
    try {
        const content = await SiteContent.find().sort({ section: 1, key: 1 });
        console.log('✅ Contenu site récupéré:', content.length, 'éléments');
        res.json(content);
    } catch (error) {
        console.error('Erreur récupération contenu:', error);
        res.status(500).json({ error: 'Erreur récupération contenu', details: error.message });
    }
});

// Obtenir le contenu d'une section spécifique
app.get('/api/admin/site-content/:section', async (req, res) => {
    try {
        const { section } = req.params;
        const content = await SiteContent.find({ section }).sort({ key: 1 });
        console.log(`✅ Contenu section '${section}' récupéré:`, content.length, 'éléments');
        res.json(content);
    } catch (error) {
        console.error('Erreur récupération contenu section:', error);
        res.status(500).json({ error: 'Erreur récupération contenu section', details: error.message });
    }
});

// Créer ou mettre à jour du contenu
app.post('/api/admin/site-content', async (req, res) => {
    try {
        const { key, value, type = 'text', section, description } = req.body;
        
        if (!key || !value || !section) {
            return res.status(400).json({ error: 'Données manquantes (key, value, section requis)' });
        }
        
        // Utiliser upsert pour créer ou mettre à jour
        const content = await SiteContent.findOneAndUpdate(
            { key },
            { value, type, section, description },
            { new: true, upsert: true }
        );
        
        console.log('✅ Contenu mis à jour:', content.key);
        res.json(content);
    } catch (error) {
        console.error('Erreur mise à jour contenu:', error);
        res.status(500).json({ error: 'Erreur mise à jour contenu', details: error.message });
    }
});

// Mettre à jour un contenu spécifique
app.put('/api/admin/site-content/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { value, type, section, description } = req.body;
        
        const content = await SiteContent.findByIdAndUpdate(
            id,
            { value, type, section, description },
            { new: true }
        );
        
        if (!content) {
            return res.status(404).json({ error: 'Contenu non trouvé' });
        }
        
        console.log('✅ Contenu modifié:', content.key);
        res.json(content);
    } catch (error) {
        console.error('Erreur modification contenu:', error);
        res.status(500).json({ error: 'Erreur modification contenu', details: error.message });
    }
});

// Supprimer du contenu
app.delete('/api/admin/site-content/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const content = await SiteContent.findByIdAndDelete(id);
        
        if (!content) {
            return res.status(404).json({ error: 'Contenu non trouvé' });
        }
        
        console.log('✅ Contenu supprimé:', content.key);
        res.json({ message: 'Contenu supprimé avec succès' });
    } catch (error) {
        console.error('Erreur suppression contenu:', error);
        res.status(500).json({ error: 'Erreur suppression contenu', details: error.message });
    }
});

// Route publique pour obtenir le contenu du site (pour l'affichage frontend)
app.get('/api/site-content', async (req, res) => {
    try {
        const content = await SiteContent.find().sort({ section: 1, key: 1 });
        
        // Convertir en objet pour faciliter l'usage frontend
        const contentObj = {};
        content.forEach(item => {
            contentObj[item.key] = {
                value: item.value,
                type: item.type,
                section: item.section
            };
        });
        
        console.log('✅ Contenu public récupéré:', Object.keys(contentObj).length, 'éléments');
        res.json(contentObj);
    } catch (error) {
        console.error('Erreur récupération contenu public:', error);
        res.status(500).json({ error: 'Erreur récupération contenu public', details: error.message });
    }
});

// Initialiser les services par défaut si la collection est vide
async function initializeDefaultServices() {
    try {
        const count = await Service.countDocuments();
        if (count === 0) {
            console.log('🔧 Initialisation des services par défaut...');
            
            const defaultServices = [
                {
                    key: 'led_therapie',
                    name: '💡 LED Thérapie',
                    description: 'Photothérapie par lumière LED - Anti-âge et purifiant',
                    price: 40,
                    duration: 30,
                    preparationTime: 15,
                    emoji: '💡',
                    label: 'Soin LED Thérapie',
                    order: 1
                },
                {
                    key: 'hydro_cleaning',
                    name: '💧 Hydro\'Cleaning',
                    description: 'Hydrafacial nouvelle génération - Nettoyage et hydratation profonde',
                    price: 90,
                    duration: 60,
                    preparationTime: 15,
                    emoji: '💧',
                    label: 'Soin Hydro\'Cleaning',
                    order: 2
                },
                {
                    key: 'microneedling',
                    name: '🔄 Renaissance',
                    description: 'Microneedling - Régénération cellulaire et stimulation du collagène',
                    price: 70,
                    duration: 75,
                    preparationTime: 15,
                    emoji: '🔄',
                    label: 'Soin Renaissance',
                    order: 3
                },
                {
                    key: 'bb_glow',
                    name: '✨ BB Glow',
                    description: 'Teint parfait semi-permanent - Effet peau de porcelaine',
                    price: 100,
                    duration: 90,
                    preparationTime: 15,
                    emoji: '✨',
                    label: 'Soin BB Glow',
                    order: 4
                },
                {
                    key: 'hydro_naissance',
                    name: '🌟 Hydro\'Naissance',
                    description: 'Protocole exclusif : Hydro\'Cleaning + Renaissance + LED en 90 minutes',
                    price: 120,
                    duration: 90,
                    preparationTime: 15,
                    emoji: '🌟',
                    label: 'Soin Hydro\'Naissance',
                    order: 5
                }
            ];
            
            await Service.insertMany(defaultServices);
            console.log('✅ Services par défaut initialisés');
        }
    } catch (error) {
        console.error('❌ Erreur initialisation services:', error);
    }
}

// Initialiser le contenu du site par défaut
async function initializeDefaultSiteContent() {
    try {
        const count = await SiteContent.countDocuments();
        if (count === 0) {
            console.log('🔧 Initialisation du contenu du site par défaut...');
            
            const defaultContent = [
                {
                    key: 'hero_title',
                    value: 'Une peau respectée, une beauté révélée',
                    type: 'text',
                    section: 'hero',
                    description: 'Titre principal de la page d\'accueil'
                },
                {
                    key: 'hero_subtitle',
                    value: 'Institut de beauté de soins avancés',
                    type: 'text',
                    section: 'hero',
                    description: 'Sous-titre de la page d\'accueil'
                },
                {
                    key: 'hero_cta',
                    value: 'Découvrir nos soins',
                    type: 'text',
                    section: 'hero',
                    description: 'Texte du bouton d\'action principal'
                },
                {
                    key: 'services_title',
                    value: 'Mes Prestations',
                    type: 'text',
                    section: 'services',
                    description: 'Titre de la section services'
                },
                {
                    key: 'contact_title',
                    value: 'Contact & Rendez-vous',
                    type: 'text',
                    section: 'contact',
                    description: 'Titre de la section contact'
                },
                {
                    key: 'about_title',
                    value: 'À propos de moi',
                    type: 'text',
                    section: 'about',
                    description: 'Titre de la section à propos'
                },
                {
                    key: 'site_name',
                    value: 'LAIA SKIN INSTITUT',
                    type: 'text',
                    section: 'general',
                    description: 'Nom du site/institut'
                },
                {
                    key: 'footer_text',
                    value: '© 2025 LAIA SKIN INSTITUT - Tous droits réservés',
                    type: 'text',
                    section: 'footer',
                    description: 'Texte du pied de page'
                }
            ];
            
            await SiteContent.insertMany(defaultContent);
            console.log('✅ Contenu du site par défaut initialisé');
        }
    } catch (error) {
        console.error('❌ Erreur initialisation contenu site:', error);
    }
}

// === ROUTES CLIENT ===
app.get('/api/clients/appointments', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        const userId = token ? token.split('_')[1] : null;
        
        console.log(`📅 Récupération RDV pour user ${userId}`);
        
        const userAppointments = await Appointment.find({ client: userId }).sort({ datetime: 1 });
        const now = new Date();
        
        const upcoming = userAppointments.filter(apt => new Date(apt.datetime) > now);
        const past = userAppointments.filter(apt => new Date(apt.datetime) <= now);
        
        res.json({ upcoming, past });
    } catch (error) {
        console.error('Erreur récupération RDV client:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

app.get('/api/clients/stats', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        const userId = token ? token.split('_')[1] : null;
        
        const userAppointments = await Appointment.find({ client: userId });
        
        res.json({
            totalAppointments: userAppointments.length,
            totalSpent: userAppointments.reduce((total, apt) => total + apt.pricing.totalPaid, 0),
            nextAppointment: userAppointments.find(apt => new Date(apt.datetime) > new Date()),
            favoriteServices: []
        });
    } catch (error) {
        console.error('Erreur récupération stats client:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Cache pour optimiser les performances
let cachedOccupiedSlots = null;
let cacheExpiry = null;
const CACHE_DURATION = 30000; // 30 secondes

// === ROUTES APPOINTMENTS ===
app.get('/api/appointments/occupied-slots', async (req, res) => {
    try {
        // Vérifier le cache
        const now = Date.now();
        if (cachedOccupiedSlots && cacheExpiry && now < cacheExpiry) {
            console.log('⚡ Cache créneaux occupés utilisé');
            return res.json(cachedOccupiedSlots);
        }
        
        console.log('🔍 Récupération créneaux occupés depuis MongoDB Atlas');
        
        const appointments = await Appointment.find({ 
            status: { $in: ['confirmé', 'en_attente'] },
            datetime: { $gte: new Date() }
        });
        
        const occupiedSlots = appointments.map(apt => ({
            datetime: apt.datetime,
            duration: apt.duration,
            status: apt.status,
            service: {
                name: 'Créneau occupé',
                category: apt.service.category
            },
            endTime: new Date(apt.datetime.getTime() + (apt.duration + 15) * 60000)
        }));
        
        console.log(`✅ ${occupiedSlots.length} créneaux occupés trouvés depuis MongoDB`);
        
        const responseData = {
            occupiedSlots,
            total: occupiedSlots.length
        };
        
        // Mettre à jour le cache
        cachedOccupiedSlots = responseData;
        cacheExpiry = Date.now() + CACHE_DURATION;
        
        res.json(responseData);
    } catch (error) {
        console.error('Erreur récupération créneaux occupés:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Route pour vérifier la détection de conflits
app.post('/api/appointments/check-conflict', async (req, res) => {
    try {
        const { datetime, duration } = req.body;
        const proposedStart = new Date(datetime);
        const proposedEnd = new Date(proposedStart.getTime() + (duration + 15) * 60000);
        
        const conflicts = await Appointment.find({
            status: { $in: ['confirmé', 'en_attente'] },
            $or: [
                // RDV qui commence pendant le créneau proposé
                {
                    datetime: { $gte: proposedStart, $lt: proposedEnd }
                },
                // RDV qui se termine pendant le créneau proposé
                {
                    $expr: {
                        $and: [
                            { $lte: ['$datetime', proposedStart] },
                            { $gte: [{ $add: ['$datetime', { $multiply: [{ $add: ['$duration', 15] }, 60000] }] }, proposedStart] }
                        ]
                    }
                }
            ]
        });
        
        res.json({
            hasConflict: conflicts.length > 0,
            conflicts: conflicts,
            message: conflicts.length > 0 ? 'Créneau non disponible' : 'Créneau disponible'
        });
    } catch (error) {
        console.error('Erreur vérification conflit:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// === ROUTES CASH BOOKING ===

// Route pour créer une réservation sans paiement en ligne
app.post('/api/create-cash-booking', async (req, res) => {
    try {
        const booking = req.body;
        
        console.log('💰 Création réservation espèces pour:', booking.email);
        
        // Create or find user account - Recherche par email pour éviter les doublons
        let user = await User.findOne({ email: booking.email.toLowerCase() });
        let isNewAccount = false;
        
        if (!user) {
            // Create new user account
            user = new User({
                name: `${booking.firstName} ${booking.lastName}`,
                email: booking.email.toLowerCase(),
                phone: booking.phone,
                password: booking.password,
                role: 'client'
            });
            await user.save();
            isNewAccount = true;
            console.log(`✅ Nouveau compte client créé: ${user.name} (${user.email})`);
        } else {
            console.log(`👤 Client existant trouvé: ${user.name} (${user.email})`);
            
            // Mettre à jour les informations du client si nécessaire
            let updated = false;
            
            // Mettre à jour le nom si différent
            const newName = `${booking.firstName} ${booking.lastName}`;
            if (user.name !== newName) {
                user.name = newName;
                updated = true;
                console.log(`📝 Nom mis à jour: ${newName}`);
            }
            
            // Mettre à jour le téléphone si différent
            if (user.phone !== booking.phone) {
                user.phone = booking.phone;
                updated = true;
                console.log(`📞 Téléphone mis à jour: ${booking.phone}`);
            }
            
            // Mettre à jour le mot de passe
            if (booking.password) {
                const hashedPassword = await bcrypt.hash(booking.password, 10);
                user.password = hashedPassword;
                updated = true;
                console.log(`🔄 Mot de passe mis à jour pour: ${user.email}`);
            }
            
            if (updated) {
                await user.save();
                console.log(`💾 Informations client mises à jour`);
            }
        }
        
        // Marquer comme utilisateur existant pour le message personnalisé
        const existingUser = !isNewAccount;
        
        // Create appointment - Conversion date française vers ISO
        console.log('🐞 DEBUG - Date reçue:', booking.date, 'Heure:', booking.time);
        
        // Convertir date française (DD/MM/YYYY) vers Date JavaScript
        const dateParts = booking.date.split('/'); // ["12", "08", "2025"]
        
        // Gérer le format d'heure "14h00" ou "14:00"
        let timeParts;
        if (booking.time.includes('h')) {
            timeParts = booking.time.split('h'); // "14h00" -> ["14", "00"]
        } else {
            timeParts = booking.time.split(':'); // "14:00" -> ["14", "00"]
        }
        
        const appointmentDate = new Date(
            parseInt(dateParts[2]), // année
            parseInt(dateParts[1]) - 1, // mois (0-indexé)
            parseInt(dateParts[0]), // jour
            parseInt(timeParts[0]), // heures
            parseInt(timeParts[1] || '0') // minutes (défaut 0 si pas spécifié)
        );
        
        console.log('🐞 DEBUG - Date convertie:', appointmentDate);
        
        // ⚠️ VÉRIFICATION DE CONFLIT DE CRÉNEAU
        const existingAppointment = await Appointment.findOne({
            datetime: appointmentDate,
            status: { $ne: 'annulé' } // Exclure les rendez-vous annulés
        });
        
        if (existingAppointment) {
            console.log(`❌ Conflit détecté - Créneau déjà occupé: ${appointmentDate}`);
            return res.status(409).json({ 
                error: 'Créneau déjà occupé',
                message: 'Ce créneau horaire est déjà réservé. Veuillez choisir une autre date/heure.',
                conflictDateTime: appointmentDate,
                existingBooking: {
                    id: existingAppointment._id,
                    service: existingAppointment.service.name
                }
            });
        }
        
        console.log('✅ Créneau disponible - Création du rendez-vous');
        
        // Configuration des services
        const serviceConfigs = {
            hydro_naissance: { name: "Hydro'Naissance", price: 120, duration: 90, category: 'hydronaissance' },
            bb_glow: { name: "BB Glow", price: 100, duration: 90, category: 'bb_glow' },
            hydro_cleaning: { name: "Hydro'Cleaning", price: 90, duration: 90, category: 'hydro_cleaning' },
            microneedling: { name: "Renaissance", price: 70, duration: 75, category: 'microneedling' },
            led_therapie: { name: "LED Thérapie", price: 40, duration: 30, category: 'led_therapie' }
        };

        // Déterminer le service (depuis le formulaire ou par défaut Hydro'Naissance)
        const serviceType = booking.serviceType || 'hydro_naissance';
        const serviceConfig = serviceConfigs[serviceType] || serviceConfigs.hydro_naissance;

        const appointment = new Appointment({
            client: user._id,
            datetime: appointmentDate,
            duration: serviceConfig.duration,
            status: 'confirmé', // Confirmé directement (pas d'acompte)
            service: {
                name: serviceConfig.name,
                category: serviceConfig.category,
                duration: serviceConfig.duration
            },
            paymentStatus: 'non_payé',
            pricing: {
                servicePrice: serviceConfig.price,
                deposit: 0, // Pas d'acompte
                totalPaid: 0
            },
            notes: {
                client: booking.notes || '',
                admin: 'Paiement intégral en espèces le jour J'
            }
        });
        
        await appointment.save();
        console.log(`📅 RDV créé: ${appointment._id}`);
        
        // Vider le cache des créneaux occupés car un nouveau RDV a été ajouté
        cachedOccupiedSlots = null;
        cacheExpiry = null;
        console.log('🔄 Cache créneaux occupés vidé');
        
        // Message personnalisé selon le type de compte
        let responseMessage = 'Réservation créée avec succès';
        if (existingUser && booking.password) {
            responseMessage += '. Votre mot de passe a été mis à jour pour faciliter l\'accès à votre espace client.';
        }

        // Réponse immédiate au client pour la rapidité
        res.json({ 
            success: true,
            bookingId: appointment._id,
            message: responseMessage
        });
        
        // PUIS traitement en arrière-plan pour ne pas bloquer l'utilisateur
        process.nextTick(async () => {
            try {
                console.log('📧 Envoi email en arrière-plan...');
                await sendConfirmationEmail(booking, appointment, isNewAccount);
                console.log('✅ Email de confirmation envoyé');
                
                // Programmer le rappel automatique
                scheduleReminder(appointment, user);
                console.log('⏰ Rappel programmé');
                
            } catch (error) {
                console.error('❌ Erreur envoi messages (non bloquant):', error);
            }
        });
        
    } catch (error) {
        console.error('❌ Erreur création réservation:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la création de la réservation',
            details: error.message 
        });
    }
});

// Route temporaire pour créer des comptes de test
app.get('/create-test-accounts', async (req, res) => {
    try {
        // Créer des comptes de test simples
        const testAccounts = [
            {
                name: 'Marie Dupont',
                email: 'marie@test.com',
                password: 'test123',
                phone: '01 23 45 67 89',
                role: 'client'
            },
            {
                name: 'Sophie Martin', 
                email: 'sophie@test.com',
                password: 'test123',
                phone: '01 98 76 54 32',
                role: 'client'
            },
            {
                name: 'Célia IVORRA',
                email: 'celia.ivorra95@hotmail.fr',
                password: 'laia123',
                phone: '06 12 34 56 78',
                role: 'client'
            }
        ];
        
        // Supprimer les anciens comptes s'ils existent
        await User.deleteMany({ email: { $in: testAccounts.map(acc => acc.email) } });
        
        // Créer les nouveaux comptes
        await User.insertMany(testAccounts);
        
        console.log('✅ Comptes de test créés');
        
        res.json({
            success: true,
            message: 'Comptes de test créés avec succès',
            accounts: testAccounts.map(acc => ({
                email: acc.email,
                password: acc.password,
                name: acc.name
            }))
        });
        
    } catch (error) {
        console.error('❌ Erreur création comptes test:', error);
        res.status(500).json({ error: 'Erreur création comptes' });
    }
});

// Route pour confirmer ou annuler un rendez-vous
app.get('/confirm-appointment', async (req, res) => {
    try {
        const { id, action } = req.query;
        
        const appointment = await Appointment.findById(id).populate('client');
        if (!appointment) {
            return res.status(404).send(`
                <html>
                <head><title>Erreur - LAIA SKIN INSTITUT</title></head>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1>❌ Rendez-vous non trouvé</h1>
                    <p>Ce lien n'est plus valide.</p>
                </body>
                </html>
            `);
        }
        
        if (action === 'confirm') {
            appointment.notes.admin += ' - Confirmé par email';
            await appointment.save();
            
            console.log(`✅ RDV confirmé par ${appointment.client.name}`);
            
            res.send(`
                <html>
                <head>
                    <title>Confirmation - LAIA SKIN INSTITUT</title>
                    <style>
                        body { font-family: 'Lora', serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #fdfbf7, #f8f6f0); }
                        .container { max-width: 500px; margin: 0 auto; background: white; padding: 2rem; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.1); }
                        .success { color: #28a745; font-size: 3rem; margin-bottom: 1rem; }
                        h1 { color: #c9a084; margin-bottom: 1rem; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="success">✅</div>
                        <h1>🌸 LAIA SKIN INSTITUT 🌸</h1>
                        <h2>Rendez-vous confirmé !</h2>
                        <p>Merci ${appointment.client.name} !</p>
                        <p>Nous vous attendons demain à ${appointment.datetime.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}.</p>
                        <p><strong>💰 N'oubliez pas :</strong> 120€ en espèces</p>
                        <p style="margin-top: 2rem; color: #666;">
                            À très bientôt,<br>
                            L'équipe LAIA SKIN INSTITUT
                        </p>
                    </div>
                </body>
                </html>
            `);
            
        } else if (action === 'reschedule') {
            appointment.status = 'à reporter';
            appointment.notes.admin += ' - Demande de report par email';
            await appointment.save();
            
            console.log(`📅 RDV à reporter demandé par ${appointment.client.name}`);
            
            res.send(`
                <html>
                <head>
                    <title>Report de rendez-vous - LAIA SKIN INSTITUT</title>
                    <style>
                        body { font-family: 'Lora', serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #fdfbf7, #f8f6f0); }
                        .container { max-width: 500px; margin: 0 auto; background: white; padding: 2rem; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.1); }
                        .reschedule { color: #fd7e14; font-size: 3rem; margin-bottom: 1rem; }
                        h1 { color: #c9a084; margin-bottom: 1rem; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="reschedule">📅</div>
                        <h1>🌸 LAIA SKIN INSTITUT 🌸</h1>
                        <h2>Demande de report enregistrée</h2>
                        <p>Merci ${appointment.client.name} !</p>
                        <p>Nous avons bien noté votre demande de report de rendez-vous.</p>
                        <p><strong>✨ Notre équipe vous recontacte dans les plus brefs délais</strong> pour vous proposer de nouveaux créneaux disponibles.</p>
                        <p style="margin-top: 2rem; color: #666;">
                            Merci de votre confiance,<br>
                            L'équipe LAIA SKIN INSTITUT
                        </p>
                    </div>
                </body>
                </html>
            `);
            
        } else if (action === 'cancel') {
            appointment.status = 'annulé';
            appointment.notes.admin += ' - Annulé par email 24h avant';
            await appointment.save();
            
            console.log(`❌ RDV annulé par ${appointment.client.name}`);
            
            res.send(`
                <html>
                <head>
                    <title>Annulation - LAIA SKIN INSTITUT</title>
                    <style>
                        body { font-family: 'Lora', serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #fdfbf7, #f8f6f0); }
                        .container { max-width: 500px; margin: 0 auto; background: white; padding: 2rem; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.1); }
                        .cancel { color: #dc3545; font-size: 3rem; margin-bottom: 1rem; }
                        h1 { color: #c9a084; margin-bottom: 1rem; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="cancel">❌</div>
                        <h1>🌸 LAIA SKIN INSTITUT 🌸</h1>
                        <h2>Rendez-vous annulé</h2>
                        <p>Merci ${appointment.client.name} de nous avoir prévenus.</p>
                        <p>Votre créneau est maintenant disponible pour d'autres clients.</p>
                        <p>N'hésitez pas à reprendre rendez-vous quand vous le souhaitez !</p>
                        <p style="margin-top: 2rem; color: #666;">
                            L'équipe LAIA SKIN INSTITUT
                        </p>
                    </div>
                </body>
                </html>
            `);
        }
        
    } catch (error) {
        console.error('❌ Erreur confirmation RDV:', error);
        res.status(500).send(`
            <html>
            <head><title>Erreur - LAIA SKIN INSTITUT</title></head>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
                <h1>❌ Erreur</h1>
                <p>Une erreur s'est produite. Contactez-nous directement.</p>
            </body>
            </html>
        `);
    }
});

// Route pour confirmer le paiement (webhook ou success)
app.post('/api/confirm-payment', async (req, res) => {
    try {
        const { session_id, appointment_id } = req.body;
        
        console.log('✅ Confirmation paiement pour session:', session_id);
        
        // Retrieve Stripe session
        const session = await stripe.checkout.sessions.retrieve(session_id);
        
        if (session.payment_status === 'paid') {
            // Update appointment
            const appointment = await Appointment.findById(appointment_id);
            if (appointment) {
                appointment.status = 'confirmé';
                appointment.paymentStatus = 'acompte_payé';
                appointment.pricing.totalPaid = 60; // 60€ d'acompte
                await appointment.save();
                
                console.log(`✅ RDV confirmé et payé: ${appointment_id}`);
                
                res.json({ 
                    success: true, 
                    message: 'Paiement confirmé, rendez-vous validé' 
                });
            } else {
                res.status(404).json({ error: 'Rendez-vous non trouvé' });
            }
        } else {
            res.status(400).json({ error: 'Paiement non confirmé' });
        }
        
    } catch (error) {
        console.error('❌ Erreur confirmation paiement:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// === WEBHOOK WHATSAPP ===

// Webhook pour recevoir les réponses WhatsApp
app.post('/webhook/whatsapp', async (req, res) => {
    try {
        const body = req.body;
        
        if (body.object === 'whatsapp_business_account') {
            body.entry?.forEach(entry => {
                entry.changes?.forEach(change => {
                    if (change.field === 'messages') {
                        const messages = change.value.messages;
                        
                        messages?.forEach(async message => {
                            if (message.type === 'text') {
                                const from = message.from;
                                const text = message.text.body.toLowerCase();
                                
                                console.log(`📱 WhatsApp reçu de ${from}: ${text}`);
                                
                                // Traiter la réponse de confirmation
                                if (text.includes('oui') || text.includes('ok') || text.includes('✅') || text.includes('confirme')) {
                                    await handleWhatsAppConfirmation(from, 'confirm');
                                } else if (text.includes('report') || text.includes('décal') || text.includes('chang') || text.includes('📅')) {
                                    await handleWhatsAppConfirmation(from, 'reschedule');
                                } else if (text.includes('non') || text.includes('annule') || text.includes('❌') || text.includes('cancel')) {
                                    await handleWhatsAppConfirmation(from, 'cancel');
                                }
                            }
                        });
                    }
                });
            });
        }
        
        res.status(200).send('OK');
        
    } catch (error) {
        console.error('❌ Erreur webhook WhatsApp:', error);
        res.status(500).send('Erreur');
    }
});

// Vérification du webhook WhatsApp (requis par Meta)
app.get('/webhook/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'laia_skin_webhook_2025';
    
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ Webhook WhatsApp vérifié');
        res.status(200).send(challenge);
    } else {
        console.log('❌ Échec vérification webhook WhatsApp');
        res.status(403).send('Forbidden');
    }
});

// Fonction pour traiter les confirmations WhatsApp
async function handleWhatsAppConfirmation(phone, action) {
    try {
        // Trouver le rendez-vous par numéro de téléphone
        const cleanPhone = phone.replace(/\D/g, '');
        const user = await User.findOne({ 
            phone: { $regex: cleanPhone, $options: 'i' } 
        });
        
        if (!user) {
            console.log(`❌ Utilisateur non trouvé pour le téléphone ${phone}`);
            return;
        }
        
        // Trouver le prochain RDV de cet utilisateur
        const appointment = await Appointment.findOne({
            client: user._id,
            status: 'confirmé',
            datetime: { $gte: new Date() }
        }).sort({ datetime: 1 });
        
        if (!appointment) {
            console.log(`❌ RDV non trouvé pour ${user.name}`);
            return;
        }
        
        if (action === 'confirm') {
            appointment.notes.admin += ' - Confirmé par WhatsApp';
            await appointment.save();
            
            const serviceEmojis = {
                hydronaissance: '🌟',
                bb_glow: '✨', 
                hydro_cleaning: '💧',
                microneedling: '🔄',
                led_therapie: '💡'
            };
            
            const serviceEmoji = serviceEmojis[appointment.service.category] || '🌟';
            
            await sendWhatsAppText(phone, 
                `✅ Parfait ${user.name} ! Votre RDV est bien confirmé.\n\n${serviceEmoji} ${appointment.service.name}\n📅 ${appointment.datetime.toLocaleDateString('fr-FR')}\n🕐 ${appointment.datetime.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}\n💰 ${appointment.pricing.servicePrice}€ en espèces\n\nÀ très bientôt ! 🌸`
            );
            
            // Enregistrer la notification pour l'admin
            await saveAdminNotification(appointment._id, 'confirm', user.name);
            
            console.log(`✅ RDV confirmé par WhatsApp: ${user.name}`);
            
        } else if (action === 'reschedule') {
            appointment.status = 'à reporter';
            appointment.notes.admin += ' - Demande de report par WhatsApp';
            await appointment.save();
            
            await sendWhatsAppText(phone, 
                `📅 ${user.name}, nous avons noté votre demande de report.\n\n✨ LAIA SKIN vous recontacte dans les plus brefs délais pour vous proposer de nouveaux créneaux.\n\nMerci de votre confiance ! 🌸`
            );
            
            // Enregistrer la notification pour l'admin
            await saveAdminNotification(appointment._id, 'reschedule', user.name);
            
            console.log(`📅 RDV à reporter demandé par WhatsApp: ${user.name}`);
            
        } else if (action === 'cancel') {
            appointment.status = 'annulé';
            appointment.notes.admin += ' - Annulé par WhatsApp - Créneau libéré automatiquement';
            await appointment.save();
            
            await sendWhatsAppText(phone, 
                `📅 RDV annulé, merci de nous avoir prévenus ${user.name}.\n\nVotre créneau est maintenant libre pour d'autres clients.\n\nN'hésitez pas à reprendre RDV quand vous le souhaitez ! 🌸`
            );
            
            // Enregistrer la notification pour l'admin
            await saveAdminNotification(appointment._id, 'cancel', user.name);
            
            console.log(`❌ RDV annulé par WhatsApp: ${user.name} - Créneau automatiquement libéré`);
        }
        
    } catch (error) {
        console.error('❌ Erreur traitement confirmation WhatsApp:', error);
    }
}

// Route pour tester WhatsApp (développement)
app.post('/test-whatsapp', async (req, res) => {
    try {
        const { phone, message } = req.body;
        
        const result = await sendWhatsAppText(phone, message);
        
        res.json({
            success: result.success,
            message: result.success ? 'Message WhatsApp envoyé' : 'Erreur envoi',
            details: result
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    }
});

// Fonction pour enregistrer une notification admin
async function saveAdminNotification(appointmentId, action, clientName) {
    try {
        const notification = new AdminNotification({
            appointmentId,
            action,
            clientName,
            timestamp: new Date()
        });
        
        await notification.save();
        console.log(`📢 Notification admin enregistrée: ${action} - ${clientName}`);
        
    } catch (error) {
        console.error('❌ Erreur sauvegarde notification admin:', error);
    }
}

// Route pour récupérer les mises à jour récentes pour l'admin
app.get('/api/admin/recent-updates', async (req, res) => {
    try {
        // Récupérer les notifications non lues des 10 dernières minutes
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        
        const recentNotifications = await AdminNotification.find({
            timestamp: { $gte: tenMinutesAgo },
            read: false
        }).sort({ timestamp: -1 });
        
        // Marquer comme lues
        if (recentNotifications.length > 0) {
            await AdminNotification.updateMany(
                { _id: { $in: recentNotifications.map(n => n._id) } },
                { read: true }
            );
        }
        
        const confirmations = recentNotifications.map(notif => ({
            appointmentId: notif.appointmentId,
            action: notif.action,
            clientName: notif.clientName,
            timestamp: notif.timestamp
        }));
        
        res.json({ confirmations });
        
    } catch (error) {
        console.error('❌ Erreur récupération mises à jour:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// === ENDPOINT TEMPORAIRE CRÉATION UTILISATEUR TEST ===
app.post('/api/auth/create-test-user', async (req, res) => {
    try {
        // Créer un utilisateur test avec les RDV existants
        const existingUser = await User.findOne({ email: 'celia.ivorra95@hotmail.fr' });
        
        if (existingUser) {
            // Mettre à jour le mot de passe
            existingUser.password = 'test123';
            await existingUser.save();
            res.json({ message: 'Mot de passe mis à jour', user: existingUser });
        } else {
            res.json({ message: 'Utilisateur non trouvé' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// === ENDPOINT TEST HISTORIQUE ===
app.post('/api/test/create-history', async (req, res) => {
    try {
        const user = await User.findOne({ email: 'celia.ivorra95@hotmail.fr' });
        if (!user) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }
        
        // Créer quelques soins terminés pour l'historique
        const pastTreatments = [
            {
                client: user._id,
                datetime: new Date('2024-12-15T14:00:00.000Z'),
                duration: 90,
                status: 'terminé',
                service: { name: 'Hydro\'Naissance', category: 'hydronaissance', duration: 90 },
                pricing: { servicePrice: 120, deposit: 0, totalPaid: 120 },
                notes: { client: '', admin: 'Excellent résultat, peau éclatante' },
                paymentStatus: 'payé'
            },
            {
                client: user._id,
                datetime: new Date('2024-11-20T10:00:00.000Z'),
                duration: 60,
                status: 'terminé',
                service: { name: 'Nettoyage de Peau', category: 'nettoyage', duration: 60 },
                pricing: { servicePrice: 80, deposit: 0, totalPaid: 80 },
                notes: { client: '', admin: 'Peau purifiée, très satisfaite' },
                paymentStatus: 'payé'
            }
        ];
        
        await Appointment.insertMany(pastTreatments);
        res.json({ message: 'Historique de test créé', count: pastTreatments.length });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// === API RENDEZ-VOUS CLIENT ===
app.get('/api/client/appointments', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Token manquant' });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        const appointments = await Appointment.find({ client: decoded.userId })
            .sort({ datetime: -1 });
        
        res.json(appointments);
        
    } catch (error) {
        console.error('❌ Erreur récupération rendez-vous client:', error);
        res.status(401).json({ error: 'Token invalide' });
    }
});

// === API HISTORIQUE DES SOINS CLIENT ===
app.get('/api/client/history', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Token manquant' });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Récupérer uniquement les RDV terminés pour l'historique
        const history = await Appointment.find({ 
            client: decoded.userId,
            status: 'terminé'
        }).sort({ datetime: -1 });
        
        res.json(history);
        
    } catch (error) {
        console.error('❌ Erreur récupération historique client:', error);
        res.status(401).json({ error: 'Token invalide' });
    }
});

// === API RÉCUPÉRATION DÉTAILS RÉSERVATION ===
app.get('/api/bookings/:id', async (req, res) => {
    try {
        const bookingId = req.params.id;
        const booking = await Appointment.findById(bookingId);
        
        if (!booking) {
            return res.status(404).json({ error: 'Réservation introuvable' });
        }
        
        res.json({
            id: booking._id,
            datetime: booking.datetime,
            service: booking.service,
            duration: booking.duration,
            price: booking.pricing?.servicePrice,
            status: booking.status
        });
        
    } catch (error) {
        console.error('❌ Erreur récupération réservation:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// === PAGES STATIQUES ===
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'mon-institut.html'));
});

// Route pour la connexion client
app.get('/client-login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'client-login.html'));
});

// Route pour l'espace client - URL explicite
app.get('/espace-client.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Route pour l'espace client (ancienne URL)
app.get('/client-dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'client-dashboard.html'));
});

// Route pour l'admin dashboard  
app.get('/admin-dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-dashboard.html'));
});


// === DÉMARRAGE SERVEUR ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`🚀 LAIA SKIN INSTITUT - Serveur principal démarré sur http://localhost:${PORT}`);
    console.log('💾 Base de données: MongoDB Atlas');
    
    // Initialiser les services par défaut
    await initializeDefaultServices();
    
    // Initialiser le contenu du site par défaut
    await initializeDefaultSiteContent();
    
    console.log('\n🔐 IDENTIFIANTS DE CONNEXION:');
    console.log('👤 Admin: admin@laiaskin.com / admin123');
    console.log('👥 Clients: marie.dupont@email.com / client123');
    console.log('           sophie.martin@email.com / client123');
    console.log('\n📅 RDV de test disponible:');
    console.log('   • Marie: 15 août 2024 à 14h00 - BB Glow (90min)');
    console.log('\n💻 Pour accéder:');
    console.log(`   📍 Site principal: http://localhost:${PORT}`);
    console.log(`   🔑 Espace client: http://localhost:${PORT}/espace-client.html`);
    console.log('\n✨ Site intégré avec MongoDB Atlas - Production ready!');
});

// === ROUTES ADMIN DASHBOARD ===

// Route pour les stats du dashboard
app.get('/api/admin/dashboard', async (req, res) => {
    try {
        const totalClients = await User.countDocuments({ role: 'client' });
        const appointmentsToday = await Appointment.countDocuments({
            datetime: {
                $gte: new Date(new Date().setHours(0,0,0,0)),
                $lte: new Date(new Date().setHours(23,59,59,999))
            }
        });
        
        res.json({
            stats: {
                totalClients,
                appointmentsToday,
                newClientsThisMonth: 0,
                appointmentsThisWeek: 0,
                totalAppointments: await Appointment.countDocuments(),
                monthlyRevenue: 0
            },
            todayAppointments: []
        });
    } catch (error) {
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Alias pour /api/admin/stats (même données que dashboard)
app.get('/api/admin/stats', async (req, res) => {
    try {
        const totalClients = await User.countDocuments({ role: 'client' });
        const appointmentsToday = await Appointment.countDocuments({
            datetime: {
                $gte: new Date(new Date().setHours(0,0,0,0)),
                $lte: new Date(new Date().setHours(23,59,59,999))
            }
        });
        
        res.json({
            totalClients,
            appointmentsToday,
            newClientsThisMonth: 0,
            appointmentsThisWeek: 0,
            totalAppointments: await Appointment.countDocuments(),
            monthlyRevenue: 0
        });
    } catch (error) {
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Route pour les rendez-vous admin
app.get('/api/admin/appointments', async (req, res) => {
    try {
        const appointments = await Appointment.find()
            .populate('client', 'name email phone')
            .sort({ datetime: -1 });
        
        res.json({ appointments });
    } catch (error) {
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Route pour les clients admin
app.get('/api/admin/clients', async (req, res) => {
    try {
        const clients = await User.find({ role: 'client' });
        res.json({ clients });
    } catch (error) {
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// === ROUTES LOYALTY ===

// Route pour mettre à jour le statut d'un rendez-vous et gérer la fidélité
app.put('/api/appointments/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        const appointment = await Appointment.findById(id).populate('client');
        if (!appointment) {
            return res.status(404).json({ message: 'Rendez-vous non trouvé' });
        }
        
        const oldStatus = appointment.status;
        appointment.status = status;
        await appointment.save();
        
        // Si le statut passe à "terminé", mettre à jour la fidélité
        if (status === 'terminé' && oldStatus !== 'terminé') {
            await updateClientLoyalty(appointment);
        }
        
        res.json({ 
            message: 'Statut mis à jour',
            appointment: appointment
        });
        
    } catch (error) {
        console.error('Erreur mise à jour statut:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Fonction pour mettre à jour la fidélité d'un client
async function updateClientLoyalty(appointment) {
    try {
        const clientId = appointment.client._id || appointment.client;
        
        // Trouver ou créer l'enregistrement de fidélité
        let loyalty = await Loyalty.findOne({ client: clientId });
        if (!loyalty) {
            loyalty = new Loyalty({ client: clientId });
        }
        
        // Déterminer le type de service (soin ou forfait)
        const serviceCategory = appointment.service.category;
        let serviceType = 'soin'; // Par défaut
        
        if (['led'].includes(serviceCategory)) {
            // LED ne compte pas dans la fidélité (trop petit prix)
            console.log(`ℹ️ LED thérapie pour ${appointment.client.name || appointment.client}: ne compte pas dans la fidélité`);
            return; // Sortir sans mettre à jour la fidélité
        }
        
        // Services qui peuvent être soins OU forfaits selon le choix client
        if (['hydrocleaning', 'renaissance', 'bbglow', 'hydronaissance'].includes(serviceCategory)) {
            // Déterminer selon le prix payé ou les informations de forfait
            const servicePrice = appointment.pricing.servicePrice;
            const isPackage = appointment.packageInfo?.isPackage || false;
            
            if (isPackage || servicePrice > 200) {
                // Si c'est un forfait ou prix élevé (forfait multiple séances)
                serviceType = 'forfait';
            } else {
                // Si c'est une séance unique
                serviceType = 'soin';
            }
        }
        
        // Ajouter le service à la fidélité
        await loyalty.addService(serviceType, appointment.service.name);
        
        console.log(`✅ Fidélité mise à jour pour ${appointment.client.name || appointment.client}: +1 ${serviceType}`);
        
    } catch (error) {
        console.error('Erreur mise à jour fidélité:', error);
    }
}

// Route pour obtenir les données de fidélité d'un client
app.get('/api/loyalty/:clientId', async (req, res) => {
    try {
        const { clientId } = req.params;
        
        let loyalty = await Loyalty.findOne({ client: clientId });
        if (!loyalty) {
            loyalty = new Loyalty({ client: clientId });
            await loyalty.save();
        }
        
        res.json({
            soinsCount: loyalty.soinsCount,
            forfaitsCount: loyalty.forfaitsCount,
            discountEarned10: loyalty.discountEarned10,
            discountEarned20: loyalty.discountEarned20,
            totalVisits: loyalty.totalVisits,
            lastActivity: loyalty.lastActivity,
            isExpired: loyalty.checkExpiration(),
            history: loyalty.history
        });
        
    } catch (error) {
        console.error('Erreur récupération fidélité:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Route pour donner une remise exceptionnelle
app.post('/api/loyalty/:clientId/exceptional-discount', async (req, res) => {
    try {
        const { clientId } = req.params;
        const { amount, reason, notes } = req.body;
        
        let loyalty = await Loyalty.findOne({ client: clientId });
        if (!loyalty) {
            loyalty = new Loyalty({ client: clientId });
        }
        
        await loyalty.giveExceptionalDiscount(amount, reason, notes);
        
        res.json({
            message: 'Remise exceptionnelle accordée',
            loyalty: {
                discountEarned10: loyalty.discountEarned10,
                discountEarned20: loyalty.discountEarned20
            }
        });
        
    } catch (error) {
        console.error('Erreur remise exceptionnelle:', error);
        res.status(500).json({ message: error.message });
    }
});

// Route pour ajouter des points de fidélité
app.post('/api/loyalty/points', async (req, res) => {
    try {
        const { clientId, points, reason, timestamp } = req.body;
        
        let loyalty = await Loyalty.findOne({ client: clientId });
        if (!loyalty) {
            loyalty = await Loyalty.create({
                client: clientId,
                points: 0,
                totalPoints: 0,
                availableDiscounts: 0,
                history: []
            });
        }
        
        // Ajouter les points
        loyalty.points = (loyalty.points || 0) + points;
        loyalty.totalPoints = (loyalty.totalPoints || 0) + points;
        
        // Ajouter à l'historique
        if (!loyalty.history) loyalty.history = [];
        loyalty.history.push({
            type: 'points_earned',
            points: points,
            reason: reason || 'Rendez-vous terminé',
            date: new Date(timestamp || Date.now())
        });
        
        // Calculer les remises disponibles (50 points = 10€ de remise)
        const newDiscounts = Math.floor(loyalty.points / 50);
        if (newDiscounts > 0) {
            loyalty.availableDiscounts = (loyalty.availableDiscounts || 0) + newDiscounts;
            loyalty.points = loyalty.points % 50;
            
            loyalty.history.push({
                type: 'discount_earned',
                amount: newDiscounts * 10,
                date: new Date()
            });
        }
        
        await loyalty.save();
        
        res.json({
            success: true,
            totalPoints: loyalty.totalPoints,
            currentPoints: loyalty.points,
            availableDiscounts: loyalty.availableDiscounts,
            discountAmount: (loyalty.availableDiscounts || 0) * 10
        });
        
    } catch (error) {
        console.error('Erreur ajout points fidélité:', error);
        res.status(500).json({ message: error.message });
    }
});

// Route pour utiliser une remise
app.post('/api/loyalty/:clientId/use-discount', async (req, res) => {
    try {
        const { clientId } = req.params;
        const { amount, appointmentId, notes } = req.body;
        
        const loyalty = await Loyalty.findOne({ client: clientId });
        if (!loyalty) {
            return res.status(404).json({ message: 'Fidélité non trouvée' });
        }
        
        await loyalty.useDiscount(amount, appointmentId, notes);
        
        res.json({
            message: 'Remise utilisée',
            loyalty: {
                discountEarned10: loyalty.discountEarned10,
                discountEarned20: loyalty.discountEarned20
            }
        });
        
    } catch (error) {
        console.error('Erreur utilisation remise:', error);
        res.status(500).json({ message: error.message });
    }
});

// Route pour obtenir tous les clients avec leur fidélité
app.get('/api/admin/clients-loyalty', async (req, res) => {
    try {
        const clients = await User.find({ role: 'client' });
        const clientsWithLoyalty = [];
        
        for (const client of clients) {
            let loyalty = await Loyalty.findOne({ client: client._id });
            if (!loyalty) {
                loyalty = new Loyalty({ client: client._id });
                await loyalty.save();
            }
            
            clientsWithLoyalty.push({
                _id: client._id,
                name: client.name,
                email: client.email,
                phone: client.phone,
                loyalty: {
                    soinsCount: loyalty.soinsCount,
                    forfaitsCount: loyalty.forfaitsCount,
                    discountEarned10: loyalty.discountEarned10,
                    discountEarned20: loyalty.discountEarned20,
                    totalVisits: loyalty.totalVisits,
                    lastActivity: loyalty.lastActivity,
                    isExpired: loyalty.checkExpiration()
                }
            });
        }
        
        res.json({ clients: clientsWithLoyalty });
        
    } catch (error) {
        console.error('Erreur récupération clients fidélité:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Route pour créer le compte admin (une seule fois)
app.get('/create-admin-account', async (req, res) => {
    try {
        // Vérifier si l'admin existe déjà
        const existingAdmin = await User.findOne({ email: process.env.ADMIN_EMAIL });
        if (existingAdmin) {
            return res.json({ success: false, message: 'Compte admin déjà existant' });
        }

        // Créer le compte admin
        const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
        const adminUser = new User({
            name: 'Administrateur LAIA SKIN',
            email: process.env.ADMIN_EMAIL,
            password: hashedPassword,
            phone: '01 23 45 67 89',
            role: 'admin'
        });

        await adminUser.save();
        console.log('✅ Compte admin créé');

        res.json({ 
            success: true, 
            message: 'Compte admin créé avec succès',
            admin: {
                email: process.env.ADMIN_EMAIL,
                password: process.env.ADMIN_PASSWORD
            }
        });

    } catch (error) {
        console.error('❌ Erreur création admin:', error);
        res.status(500).json({ success: false, message: 'Erreur création admin' });
    }
});

// Route debug pour vérifier les utilisateurs admin
app.get('/debug-admin', async (req, res) => {
    try {
        const admins = await User.find({ email: process.env.ADMIN_EMAIL });
        console.log('🔍 Debug admin:', admins);
        res.json({ admins: admins.map(admin => ({ 
            _id: admin._id,
            name: admin.name, 
            email: admin.email, 
            role: admin.role,
            createdAt: admin.createdAt 
        })) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route pour réinitialiser le mot de passe admin
app.get('/reset-admin-password', async (req, res) => {
    try {
        const admin = await User.findOne({ email: process.env.ADMIN_EMAIL });
        if (!admin) {
            return res.json({ success: false, message: 'Admin non trouvé' });
        }

        // Réinitialiser le mot de passe
        const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
        admin.password = hashedPassword;
        await admin.save();

        console.log('✅ Mot de passe admin réinitialisé');
        res.json({ 
            success: true, 
            message: 'Mot de passe admin réinitialisé',
            credentials: {
                email: process.env.ADMIN_EMAIL,
                password: process.env.ADMIN_PASSWORD
            }
        });

    } catch (error) {
        console.error('❌ Erreur réinitialisation admin:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// Route pour réinitialiser les mots de passe de tous les clients test
app.get('/reset-test-clients-passwords', async (req, res) => {
    try {
        const testEmails = ['marie@test.com', 'sophie@test.com', 'celia.ivorra95@hotmail.fr'];
        const results = [];

        for (const email of testEmails) {
            const client = await User.findOne({ email: email.toLowerCase(), role: 'client' });
            if (client) {
                const hashedPassword = await bcrypt.hash('test123', 10);
                client.password = hashedPassword;
                await client.save();
                results.push({ email, status: 'password reset' });
                console.log(`✅ Mot de passe réinitialisé pour ${email}`);
            } else {
                results.push({ email, status: 'not found' });
            }
        }

        res.json({ 
            success: true, 
            message: 'Mots de passe clients réinitialisés',
            results
        });

    } catch (error) {
        console.error('❌ Erreur réinitialisation clients:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// Route PATCH pour mettre à jour partiellement un rendez-vous
app.patch('/api/appointments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const appointment = await Appointment.findByIdAndUpdate(
            id,
            updates,
            { new: true, runValidators: true }
        ).populate('client', 'name email phone');
        
        if (!appointment) {
            return res.status(404).json({ message: 'Rendez-vous non trouvé' });
        }
        
        // Si le statut passe à "terminé", attribuer les points de fidélité
        if (updates.status === 'terminé' && appointment.client) {
            try {
                const loyaltyResponse = await fetch(`http://localhost:${PORT}/api/loyalty/points`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        clientId: appointment.client._id,
                        points: 10,
                        reason: `Rendez-vous terminé: ${appointment.service?.name || 'Service'}`,
                        timestamp: updates.completedAt || new Date().toISOString()
                    })
                });
                
                if (loyaltyResponse.ok) {
                    const loyaltyData = await loyaltyResponse.json();
                    console.log(`✅ Points fidélité attribués: ${loyaltyData.currentPoints} points`);
                }
            } catch (loyaltyError) {
                console.error('Erreur attribution points fidélité:', loyaltyError);
            }
        }
        
        res.json(appointment);
        
    } catch (error) {
        console.error('Erreur mise à jour rendez-vous:', error);
        res.status(500).json({ message: error.message });
    }
});

// Route pour modifier un rendez-vous (date/heure)
app.put('/api/appointments/:id/reschedule', async (req, res) => {
    try {
        const { id } = req.params;
        const { date, time } = req.body;
        
        // Vérification du token
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Token manquant' });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Récupérer l'ancien rendez-vous
        const oldAppointment = await Appointment.findById(id).populate('client');
        if (!oldAppointment) {
            return res.status(404).json({ message: 'Rendez-vous non trouvé' });
        }
        
        // Vérifier que le client peut modifier ce rendez-vous
        if (decoded.role !== 'admin' && oldAppointment.client._id.toString() !== decoded.userId) {
            return res.status(403).json({ message: 'Non autorisé' });
        }
        
        console.log(`🔄 Modification RDV ${id}: ${date} ${time}`);
        
        // Convertir la nouvelle date/heure
        const dateParts = date.split('/'); // ["15", "08", "2025"]
        let timeParts;
        if (time.includes('h')) {
            timeParts = time.split('h'); // "14h00" -> ["14", "00"]
        } else {
            timeParts = time.split(':'); // "14:00" -> ["14", "00"]
        }
        
        const newDatetime = new Date(
            parseInt(dateParts[2]), // année
            parseInt(dateParts[1]) - 1, // mois (0-indexé)
            parseInt(dateParts[0]), // jour
            parseInt(timeParts[0]), // heures
            parseInt(timeParts[1] || '0') // minutes
        );
        
        console.log('🐞 DEBUG - Nouvelle date convertie:', newDatetime);
        
        // Vérifier la disponibilité du nouveau créneau
        const existingAppointment = await Appointment.findOne({
            datetime: newDatetime,
            _id: { $ne: id }, // Exclure le rendez-vous actuel
            status: { $ne: 'annulé' }
        });
        
        if (existingAppointment) {
            return res.status(409).json({ message: 'Créneau déjà occupé' });
        }
        
        // Mettre à jour le rendez-vous
        oldAppointment.datetime = newDatetime;
        oldAppointment.notes.admin += ` | Modifié le ${new Date().toLocaleString('fr-FR')}`;
        await oldAppointment.save();
        
        // Vider le cache des créneaux occupés
        cachedOccupiedSlots = null;
        cacheExpiry = null;
        console.log('🔄 Cache créneaux occupés vidé');
        
        res.json({ 
            success: true,
            message: 'Rendez-vous reprogrammé avec succès',
            appointment: oldAppointment,
            oldDatetime: oldAppointment.datetime,
            newDatetime: newDatetime
        });
        
    } catch (error) {
        console.error('❌ Erreur modification rendez-vous:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// === ROUTES RÉINITIALISATION MOT DE PASSE ===

// Demande de réinitialisation de mot de passe
app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            // Pour la sécurité, on renvoie le même message même si l'utilisateur n'existe pas
            return res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé.' });
        }
        
        // Générer le token de réinitialisation (version test simplifiée)
        const crypto = require('crypto');
        const resetToken = crypto.randomBytes(32).toString('hex');
        
        // POUR TEST : stocker le token en clair (en production, il faut le hasher)
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
        await user.save();
        
        console.log(`🔐 Token de réinitialisation généré pour: ${user.email}`);
        
        // Créer l'URL de réinitialisation
        const resetUrl = `${req.protocol}://${req.get('host')}/reset-password.html?token=${resetToken}`;
        
        // Mode test : afficher le lien dans la console au lieu d'envoyer l'email
        console.log(`\n🔗 LIEN DE RÉINITIALISATION TEST:`);
        console.log(`📧 Pour: ${user.email} (${user.name})`);
        console.log(`🔗 Lien: ${resetUrl}`);
        console.log(`⏰ Expire dans 10 minutes\n`);
        
        // En mode production, décommentez ces lignes et commentez le bloc ci-dessus
        // process.nextTick(async () => {
        //     try {
        //         await sendPasswordResetEmail(user.email, user.name, resetUrl);
        //         console.log(`✅ Email de réinitialisation envoyé à: ${user.email}`);
        //     } catch (error) {
        //         console.error('❌ Erreur envoi email réinitialisation:', error);
        //     }
        // });
        
        res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé.' });
    } catch (error) {
        console.error('❌ Erreur demande réinitialisation:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Réinitialisation du mot de passe avec token
app.post('/api/auth/reset-password', async (req, res) => {
    console.log(`🔄 Route reset-password appelée`);
    console.log(`📦 Body reçu:`, req.body);
    
    try {
        const { token, newPassword } = req.body;
        
        if (!token || !newPassword) {
            return res.status(400).json({ message: 'Token et nouveau mot de passe requis' });
        }
        
        console.log(`🔍 Debug token de réinitialisation:`);
        console.log(`📥 Token reçu: ${token}`);
        console.log(`⏰ Timestamp actuel: ${Date.now()}`);
        
        // VERSION TEST : comparer directement sans hash
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });
        
        console.log(`👤 Utilisateur trouvé: ${user ? user.email : 'Aucun'}`);
        
        if (!user) {
            // Chercher sans la condition d'expiration pour voir si le token existe
            const userToken = await User.findOne({
                resetPasswordToken: token
            });
            
            if (userToken) {
                console.log(`⏰ Token expiré pour: ${userToken.email}, expire: ${userToken.resetPasswordExpires}, maintenant: ${Date.now()}`);
                return res.status(400).json({ message: 'Token expiré' });
            } else {
                console.log(`❌ Token introuvable dans la base`);
                return res.status(400).json({ message: 'Token invalide' });
            }
        }
        
        // Réinitialiser le mot de passe
        user.password = newPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        
        console.log(`🔄 Mot de passe réinitialisé pour: ${user.email}`);
        
        res.json({ message: 'Mot de passe réinitialisé avec succès' });
    } catch (error) {
        console.error('❌ Erreur réinitialisation mot de passe:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Modification du mot de passe (utilisateur connecté)
app.post('/api/auth/change-password', async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Mot de passe actuel et nouveau mot de passe requis' });
        }
        
        // Vérifier le token JWT
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Token manquant' });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
        
        // Vérifier le mot de passe actuel
        const bcrypt = require('bcryptjs');
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
            return res.status(400).json({ message: 'Mot de passe actuel incorrect' });
        }
        
        // Mettre à jour le mot de passe
        user.password = newPassword;
        await user.save();
        
        console.log(`🔄 Mot de passe modifié pour: ${user.email}`);
        
        res.json({ message: 'Mot de passe modifié avec succès' });
    } catch (error) {
        console.error('❌ Erreur modification mot de passe:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Fonction pour envoyer l'email de réinitialisation
async function sendPasswordResetEmail(email, name, resetUrl) {
    const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #d4a574; font-family: 'Playfair Display', serif;">Laia Skin Institut</h1>
                <p style="color: #666; font-style: italic;">Une peau respectée, une beauté affirmée</p>
            </div>
            
            <div style="background: linear-gradient(135deg, #f7f1e8, #ffffff); padding: 30px; border-radius: 15px; border: 2px solid #d4a574;">
                <h2 style="color: #8b6f47; margin-bottom: 20px;">🔐 Réinitialisation de votre mot de passe</h2>
                
                <p>Bonjour <strong>${name}</strong>,</p>
                
                <p>Vous avez demandé la réinitialisation de votre mot de passe pour votre espace client Laia Skin Institut.</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetUrl}" style="background: linear-gradient(135deg, #d4a574, #c9a084); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
                        ✨ Réinitialiser mon mot de passe
                    </a>
                </div>
                
                <p style="font-size: 14px; color: #666;">
                    ⏰ <strong>Important :</strong> Ce lien est valide pendant 10 minutes seulement pour votre sécurité.
                </p>
                
                <p style="font-size: 14px; color: #666;">
                    Si vous n'avez pas demandé cette réinitialisation, ignorez simplement cet email. Votre mot de passe actuel reste inchangé.
                </p>
                
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #d4a574;">
                
                <div style="text-align: center; color: #888; font-size: 12px;">
                    <p>Laia Skin Institut - Institut de beauté & soins du visage</p>
                    <p>📧 ${process.env.SMTP_FROM_EMAIL} | 📱 Votre numéro</p>
                </div>
            </div>
        </div>
    `;
    
    const mailOptions = {
        from: `"Laia Skin Institut" <${process.env.SMTP_FROM_EMAIL}>`,
        to: email,
        subject: '🔐 Réinitialisation de votre mot de passe - Laia Skin Institut',
        html: emailHtml
    };
    
    await transporter.sendMail(mailOptions);
}

// Route debug pour voir tous les utilisateurs Marie
app.get('/debug-marie', async (req, res) => {
    try {
        const maries = await User.find({ $or: [
            { email: 'marie@test.com' },
            { email: 'marie.dupont@email.com' },
            { name: /Marie/i }
        ]});
        
        console.log('🔍 Debug Marie:', maries);
        res.json({ maries: maries.map(marie => ({ 
            _id: marie._id,
            name: marie.name, 
            email: marie.email, 
            role: marie.role,
            createdAt: marie.createdAt 
        })) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

process.on('SIGINT', () => {
    console.log('\n👋 Arrêt du serveur LAIA SKIN INSTITUT');
    mongoose.connection.close();
    process.exit(0);
});