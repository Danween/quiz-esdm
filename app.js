// Quiz ESDM - Main Application Logic
// Dinas ESDM Provinsi Jambi

// Configuration
const CONFIG = {
    // JSONBin.io Configuration (FREE Cloud Storage)
    // 1. Daftar di https://jsonbin.io (gratis)
    // 2. Create New Bin → Paste: {"participants":[]}
    // 3. Copy Bin ID dan X-Master-Key
    USE_JSONBIN: true, // Set true untuk pakai JSONBin.io
    JSONBIN_BIN_ID: '6953453aae596e708fb93aa6', // Bin ID dari JSONBin
    JSONBIN_API_KEY: '$2a$10$U7S9BIp0OvtRud.X7BmGyuU/E85luvzicc7zURmtyKYm6qG8s4qp6', // X-Master-Key dari JSONBin
    
    SYNC_INTERVAL: 2000 // Sync setiap 2 detik
};

// Initialize localStorage if empty (fallback)
if (!localStorage.getItem('participants')) {
    localStorage.setItem('participants', JSON.stringify([]));
}

// JSONBin.io Sync Functions
const JSONBinSync = {
    // Fetch participants from JSONBin
    async fetchParticipants() {
        if (!CONFIG.USE_JSONBIN || CONFIG.JSONBIN_BIN_ID === 'YOUR_BIN_ID_HERE') {
            console.warn('JSONBin not configured, using localStorage');
            return null;
        }

        try {
            const response = await fetch(`https://api.jsonbin.io/v3/b/${CONFIG.JSONBIN_BIN_ID}/latest`, {
                method: 'GET',
                headers: {
                    'X-Master-Key': CONFIG.JSONBIN_API_KEY
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.record.participants || [];
            }
        } catch (error) {
            console.warn('JSONBin fetch failed, using localStorage:', error);
        }
        return null;
    },

    // Save participants to JSONBin
    async saveParticipants(participants) {
        if (!CONFIG.USE_JSONBIN || CONFIG.JSONBIN_BIN_ID === 'YOUR_BIN_ID_HERE') {
            return false;
        }

        try {
            const response = await fetch(`https://api.jsonbin.io/v3/b/${CONFIG.JSONBIN_BIN_ID}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': CONFIG.JSONBIN_API_KEY
                },
                body: JSON.stringify({ participants })
            });
            return response.ok;
        } catch (error) {
            console.warn('JSONBin save failed:', error);
            return false;
        }
    },

    // Clear all data on JSONBin
    async clearAll() {
        if (!CONFIG.USE_JSONBIN || CONFIG.JSONBIN_BIN_ID === 'YOUR_BIN_ID_HERE') {
            return false;
        }

        try {
            const response = await fetch(`https://api.jsonbin.io/v3/b/${CONFIG.JSONBIN_BIN_ID}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': CONFIG.JSONBIN_API_KEY
                },
                body: JSON.stringify({ participants: [] })
            });
            return response.ok;
        } catch (error) {
            console.warn('JSONBin clear failed:', error);
            return false;
        }
    }
};

// Alias untuk compatibility
const ServerSync = JSONBinSync;

// Utility Functions
const QuizApp = {
    // Get all participants
    getParticipants: async function() {
        if (CONFIG.USE_JSONBIN) {
            const cloudData = await JSONBinSync.fetchParticipants();
            if (cloudData) {
                // Update localStorage sebagai cache
                localStorage.setItem('participants', JSON.stringify(cloudData));
                return cloudData;
            }
        }
        return JSON.parse(localStorage.getItem('participants') || '[]');
    },

    // Save participants
    saveParticipants: async function(participants) {
        // Simpan ke localStorage dulu (instant feedback)
        localStorage.setItem('participants', JSON.stringify(participants));
        
        // Sync ke cloud
        if (CONFIG.USE_JSONBIN) {
            await JSONBinSync.saveParticipants(participants);
        }
        
        this.triggerStorageEvent();
    },

    // Get participant by ID
    getParticipantById: async function(id) {
        const participants = await this.getParticipants();
        return participants.find(p => p.id === parseInt(id));
    },

    // Update participant
    updateParticipant: async function(id, updates) {
        const participants = await this.getParticipants();
        const index = participants.findIndex(p => p.id === parseInt(id));
        
        if (index !== -1) {
            participants[index] = { ...participants[index], ...updates };
            await this.saveParticipants(participants);
            return participants[index];
        }
        return null;
    },

    // Delete participant
    deleteParticipant: async function(id) {
        let participants = await this.getParticipants();
        participants = participants.filter(p => p.id !== parseInt(id));
        await this.saveParticipants(participants);
    },

    // Clear all participants
    clearAllParticipants: async function() {
        if (confirm('Yakin ingin menghapus semua data peserta?')) {
            if (CONFIG.USE_JSONBIN) {
                await JSONBinSync.clearAll();
            }
            localStorage.setItem('participants', JSON.stringify([]));
            this.triggerStorageEvent();
            return true;
        }
        return false;
    },

    // Get random questions from bank
    getRandomQuestions: function(count) {
        if (typeof questionBank === 'undefined') {
            console.error('Question bank not loaded');
            return [];
        }
        
        const shuffled = [...questionBank].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
    },

    // Calculate score
    calculateScore: function(answers, questions) {
        let score = 0;
        answers.forEach(answer => {
            if (answer.isCorrect) {
                score++;
            }
        });
        return score;
    },

    // Format date
    formatDate: function(dateString) {
        const date = new Date(dateString);
        const options = { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        };
        return date.toLocaleDateString('id-ID', options);
    },

    // Trigger storage event for cross-tab communication
    triggerStorageEvent: function() {
        window.dispatchEvent(new Event('storage'));
    },

    // Export results to CSV
    exportToCSV: async function() {
        const participants = await this.getParticipants();
        if (participants.length === 0) {
            alert('Tidak ada data untuk diekspor');
            return;
        }

        let csv = 'No,Nama,No HP,Email,Instansi,Status,Skor,Total Soal,Persentase,Waktu Daftar,Waktu Selesai\n';
        
        participants.forEach((p, index) => {
            const totalQuestions = p.questions?.length || 0;
            const percentage = totalQuestions > 0 ? Math.round((p.score / totalQuestions) * 100) : 0;
            
            csv += `${index + 1},`;
            csv += `"${p.nama}",`;
            csv += `"${p.noHp}",`;
            csv += `"${p.email}",`;
            csv += `"${p.instansi || '-'}",`;
            csv += `"${p.status}",`;
            csv += `${p.score || 0},`;
            csv += `${totalQuestions},`;
            csv += `${percentage}%,`;
            csv += `"${this.formatDate(p.registeredAt)}",`;
            csv += `"${p.finishedAt ? this.formatDate(p.finishedAt) : '-'}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `quiz-esdm-${new Date().getTime()}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    // Get statistics
    getStatistics: async function() {
        const participants = await this.getParticipants();
        
        return {
            total: participants.length,
            waiting: participants.filter(p => p.status === 'waiting').length,
            playing: participants.filter(p => p.status === 'playing').length,
            finished: participants.filter(p => p.status === 'finished').length,
            averageScore: await this.getAverageScore(),
            highestScore: await this.getHighestScore(),
            lowestScore: await this.getLowestScore()
        };
    },

    // Get average score
    getAverageScore: async function() {
        const participants = await this.getParticipants();
        const finishedParticipants = participants.filter(p => p.status === 'finished');
        
        if (finishedParticipants.length === 0) return 0;
        
        const totalScore = finishedParticipants.reduce((sum, p) => sum + (p.score || 0), 0);
        return Math.round(totalScore / finishedParticipants.length);
    },

    // Get highest score
    getHighestScore: async function() {
        const participants = await this.getParticipants();
        const finishedParticipants = participants.filter(p => p.status === 'finished');
        
        if (finishedParticipants.length === 0) return 0;
        
        return Math.max(...finishedParticipants.map(p => p.score || 0));
    },

    // Get lowest score
    getLowestScore: async function() {
        const participants = await this.getParticipants();
        const finishedParticipants = participants.filter(p => p.status === 'finished');
        
        if (finishedParticipants.length === 0) return 0;
        
        return Math.min(...finishedParticipants.map(p => p.score || 0));
    },

    // Validate phone number
    validatePhone: function(phone) {
        const phoneRegex = /^[0-9]{10,13}$/;
        return phoneRegex.test(phone);
    },

    // Validate email
    validateEmail: function(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    // Show toast notification
    showToast: function(message, type = 'info') {
        // Simple toast notification
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 px-6 py-4 rounded-lg shadow-lg text-white z-50 animate-fade-in`;
        
        switch(type) {
            case 'success':
                toast.classList.add('bg-green-500');
                break;
            case 'error':
                toast.classList.add('bg-red-500');
                break;
            case 'warning':
                toast.classList.add('bg-yellow-500');
                break;
            default:
                toast.classList.add('bg-blue-500');
        }
        
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
};

// Global error handler
window.addEventListener('error', function(e) {
    console.error('Application Error:', e.error);
});

// Log initialization
console.log('Quiz ESDM Application Loaded');
console.log('JSONBin Sync:', CONFIG.USE_JSONBIN ? 'Enabled' : 'Disabled');
if (CONFIG.USE_JSONBIN) {
    console.log('JSONBin Configured:', CONFIG.JSONBIN_BIN_ID !== 'YOUR_BIN_ID_HERE' ? 'YES ✓' : 'NO - Please configure!');
}
console.log('Question Bank Size:', typeof questionBank !== 'undefined' ? questionBank.length : 'Not loaded');

// Auto-sync from cloud every interval
if (CONFIG.USE_JSONBIN && CONFIG.JSONBIN_BIN_ID !== 'YOUR_BIN_ID_HERE') {
    setInterval(async () => {
        await QuizApp.getParticipants(); // Fetch latest dari cloud
    }, CONFIG.SYNC_INTERVAL);
    
    console.log(`Auto-sync enabled: ${CONFIG.SYNC_INTERVAL}ms interval`);
}

// Make QuizApp available globally
window.QuizApp = QuizApp;
