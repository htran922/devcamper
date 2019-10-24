const express = require('express');
const dotenv = require('dotenv');
const morgan = require('morgan');
const connectDB = require('./config/db');
const colors = require('colors');

// Load env vars
dotenv.config({ path: './config/config.env' });

// Connect to DB
connectDB();

// Route files
const bootcamps = require('./routes/bootcamps');


const app = express();

// Body parser
app.use(express.json());

// Dev logging middleware
// Only want to run if we are in development environment
if (process.env.NODE_ENV === 'development'){
    app.use(morgan('dev'));
}

// Mount routers 
app.use('/api/v1/bootcamps', bootcamps);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`.rainbow.bold));

// Handle unhandled promise rejections
// We get an error message for what happens and app crashes, instead of app working
process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`.red);
    // Close server & exit process
    server.close(() => process.exit(1));
});