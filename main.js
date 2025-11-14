// Application de Gestion des Stocks - JavaScript Principal
class StockManager {
    constructor() {
        this.currentUser = null;
        this.currentCompany = null;
        this.products = [];
        this.transactions = [];
        this.invoices = [];
        this.clients = [];
        this.init();
    }

    init() {
        this.loadData();
        this.initEventListeners();
        this.updateDashboard();
    }

    // Gestion des données
    loadData() {
        const savedData = localStorage.getItem('stockManagerData');
        if (savedData) {
            const data = JSON.parse(savedData);
            this.currentUser = data.currentUser || null;
            this.currentCompany = data.currentCompany || null;
            this.products = data.products || [];
            this.transactions = data.transactions || [];
            this.invoices = data.invoices || [];
            this.clients = data.clients || [];
        }
    }

    saveData() {
        const data = {
            currentUser: this.currentUser,
            currentCompany: this.currentCompany,
            products: this.products,
            transactions: this.transactions,
            invoices: this.invoices,
            clients: this.clients
        };
        localStorage.setItem('stockManagerData', JSON.stringify(data));
    }

    // Authentification
    login(email, password) {
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        const user = users.find(u => u.email === email && u.password === password);
        if (user) {
            this.currentUser = user;
            this.currentCompany = user.company;
            this.saveData();
            return true;
        }
        return false;
    }

    register(userData) {
        let users = JSON.parse(localStorage.getItem('users') || '[]');
        const existingUser = users.find(u => u.email === userData.email);
        if (existingUser) {
            return false;
        }
        
        const newUser = {
            id: Date.now(),
            ...userData,
            createdAt: new Date().toISOString()
        };
        
        users.push(newUser);
        localStorage.setItem('users', JSON.stringify(users));
        this.currentUser = newUser;
        this.currentCompany = newUser.company;
        this.saveData();
        return true;
    }

    // Gestion des produits
    addProduct(productData) {
        const product = {
            id: Date.now(),
            code: this.generateProductCode(),
            ...productData,
            stock: 0,
            createdAt: new Date().toISOString()
        };
        this.products.push(product);
        this.saveData();
        return product;
    }

    updateProduct(id, updates) {
        const index = this.products.findIndex(p => p.id === id);
        if (index !== -1) {
            this.products[index] = { ...this.products[index], ...updates };
            this.saveData();
            return this.products[index];
        }
        return null;
    }

    deleteProduct(id) {
        this.products = this.products.filter(p => p.id !== id);
        this.saveData();
    }

    generateProductCode() {
        return 'PROD-' + Date.now().toString().slice(-6);
    }

    // Gestion des stocks
    addStock(productId, quantity, costPrice, supplier = '') {
        const product = this.products.find(p => p.id === productId);
        if (product) {
            product.stock += quantity;
            
            const transaction = {
                id: Date.now(),
                type: 'entry',
                productId,
                productName: product.name,
                quantity,
                unitPrice: costPrice,
                total: quantity * costPrice,
                supplier,
                date: new Date().toISOString()
            };
            
            this.transactions.push(transaction);
            this.saveData();
            return transaction;
        }
        return null;
    }

    removeStock(productId, quantity, sellingPrice, client = '') {
        const product = this.products.find(p => p.id === productId);
        if (product && product.stock >= quantity) {
            product.stock -= quantity;
            
            const transaction = {
                id: Date.now(),
                type: 'exit',
                productId,
                productName: product.name,
                quantity,
                unitPrice: sellingPrice,
                total: quantity * sellingPrice,
                client,
                date: new Date().toISOString()
            };
            
            this.transactions.push(transaction);
            this.saveData();
            return transaction;
        }
        return null;
    }

    // Gestion des factures
    createInvoice(invoiceData) {
        const invoice = {
            id: Date.now(),
            number: this.generateInvoiceNumber(),
            ...invoiceData,
            total: this.calculateInvoiceTotal(invoiceData.items),
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        
        this.invoices.push(invoice);
        
        // Mettre à jour le stock
        invoiceData.items.forEach(item => {
            this.removeStock(item.productId, item.quantity, item.price, invoiceData.clientName);
        });
        
        this.saveData();
        return invoice;
    }

    generateInvoiceNumber() {
        const year = new Date().getFullYear();
        const count = this.invoices.filter(i => new Date(i.createdAt).getFullYear() === year).length + 1;
        return `FA-${year}-${count.toString().padStart(4, '0')}`;
    }

    calculateInvoiceTotal(items) {
        return items.reduce((total, item) => total + (item.quantity * item.price), 0);
    }

    // Analytics
    getRevenueData(days = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        return this.transactions
            .filter(t => t.type === 'exit' && new Date(t.date) >= cutoffDate)
            .reduce((total, t) => total + t.total, 0);
    }

    getTopProducts(limit = 5) {
        const productSales = {};
        
        this.transactions
            .filter(t => t.type === 'exit')
            .forEach(t => {
                if (!productSales[t.productId]) {
                    productSales[t.productId] = {
                        product: this.products.find(p => p.id === t.productId),
                        totalQuantity: 0,
                        totalRevenue: 0
                    };
                }
                productSales[t.productId].totalQuantity += t.quantity;
                productSales[t.productId].totalRevenue += t.total;
            });
        
        return Object.values(productSales)
            .sort((a, b) => b.totalRevenue - a.totalRevenue)
            .slice(0, limit);
    }

    getLowStockProducts() {
        return this.products.filter(p => p.stock <= (p.minStock || 10));
    }

    // Initialisation des écouteurs d'événements
    initEventListeners() {
        // Navigation
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-page]')) {
                e.preventDefault();
                this.navigateToPage(e.target.dataset.page);
            }
        });

        // Formulaires
        document.addEventListener('submit', (e) => {
            if (e.target.matches('#loginForm')) {
                e.preventDefault();
                this.handleLogin(e.target);
            }
            if (e.target.matches('#registerForm')) {
                e.preventDefault();
                this.handleRegister(e.target);
            }
            if (e.target.matches('#productForm')) {
                e.preventDefault();
                this.handleAddProduct(e.target);
            }
        });
    }

    // Gestion des formulaires
    handleLogin(form) {
        const formData = new FormData(form);
        const email = formData.get('email');
        const password = formData.get('password');
        
        if (this.login(email, password)) {
            window.location.href = 'dashboard.html';
        } else {
            this.showAlert('Email ou mot de passe incorrect', 'error');
        }
    }

    handleRegister(form) {
        const formData = new FormData(form);
        const userData = {
            name: formData.get('name'),
            email: formData.get('email'),
            password: formData.get('password'),
            company: {
                name: formData.get('companyName'),
                address: formData.get('companyAddress'),
                phone: formData.get('companyPhone'),
                logo: formData.get('companyLogo')
            }
        };
        
        if (this.register(userData)) {
            window.location.href = 'dashboard.html';
        } else {
            this.showAlert('Cet email est déjà utilisé', 'error');
        }
    }

    handleAddProduct(form) {
        const formData = new FormData(form);
        const productData = {
            name: formData.get('name'),
            category: formData.get('category'),
            purchasePrice: parseFloat(formData.get('purchasePrice')),
            sellingPrice: parseFloat(formData.get('sellingPrice')),
            minStock: parseInt(formData.get('minStock')) || 10
        };
        
        this.addProduct(productData);
        this.showAlert('Produit ajouté avec succès', 'success');
        form.reset();
        this.updateProductsList();
    }

    // Utilitaires
    showAlert(message, type = 'info') {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg`;
        alert.textContent = message;
        document.body.appendChild(alert);
        
        setTimeout(() => {
            alert.remove();
        }, 3000);
    }

    navigateToPage(page) {
        if (page === 'dashboard' && this.currentUser) {
            window.location.href = 'dashboard.html';
        } else if (page === 'products' && this.currentUser) {
            window.location.href = 'products.html';
        } else if (page === 'inventory' && this.currentUser) {
            window.location.href = 'inventory.html';
        } else if (page === 'billing' && this.currentUser) {
            window.location.href = 'billing.html';
        } else if (page === 'settings' && this.currentUser) {
            window.location.href = 'settings.html';
        } else {
            window.location.href = 'index.html';
        }
    }

    updateDashboard() {
        if (typeof this.updateDashboardCharts === 'function') {
            this.updateDashboardCharts();
        }
    }

    updateProductsList() {
        if (typeof this.renderProductsList === 'function') {
            this.renderProductsList();
        }
    }
}

// Initialisation de l'application
let stockManager;
document.addEventListener('DOMContentLoaded', () => {
    stockManager = new StockManager();
});

// Export pour utilisation dans d'autres fichiers
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StockManager;
}