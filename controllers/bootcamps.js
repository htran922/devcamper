const path = require('path');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const geocoder = require('../utils/geocoder');
const Bootcamp = require('../models/Bootcamp');


// @desc    Get all bootcamps
// @route   GET /api/v1/bootcamps
// @access  Public
exports.getBootcamps = asyncHandler(async (req, res, next) => {
    let query;

    // Copy req.query
    const reqQuery = { ...req.query };

    // Fields to exclude that we don't want to be matched when filtering
    const removeFields = ['select', 'sort', 'page', 'limit'];

    // Loop over removeFields and delete them from reqQuery
    removeFields.forEach(param => delete reqQuery[param]);

    // Create query string
    let queryStr = JSON.stringify(reqQuery);

    // Create operators($gt, $gte, etc.)
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

    // Finding resource 
    query = Bootcamp.find(JSON.parse(queryStr)).populate('courses');

    // Select Fields
    if(req.query.select) {
        const fields = req.query.select.split(',').join(' ');
        query = query.select(fields);
    }

    // Sort
    if(req.query.sort) {
        const sortBy = req.query.sort.split(',').join(' ');
        query = query.sort(sortBy);
    } else {
        // Default sort by date
        query = query.sort('-createdAt');
    }

    // Pagination
    // Page 1 is default unless otherwise specified
    const page = parseInt(req.query.page, 10) || 1;
    // 100 per page is default
    const limit = parseInt(req.query.limit, 10) || 25;
    const startIndex = (page - 1) * limit; 
    const endIndex = page * limit;
    const total = await Bootcamp.countDocuments();


    query = query.skip(startIndex).limit(limit);

    // Executing query
    const bootcamps = await query;

    // Pagination result
    const pagination = {};

    // If there is no previous page or if there is no next page, we don't want to show
    if(endIndex < total) {
        pagination.next = {
            page: page + 1,
            limit                   // same as doing limit:limit
        }
    }

    if(startIndex > 0) {
        pagination.prev = {
            page: page - 1,
            limit
        }
    }
    res.status(200).json({ success: true, count: bootcamps.length, pagination, data: bootcamps });

});

// @desc    Get single bootcamp
// @route   GET /api/v1/bootcamps/:id
// @access  Public
exports.getBootcamp = asyncHandler(async (req, res, next) => {
    const bootcamp = await Bootcamp.findById(req.params.id);

    // check for if bootcamp id is correctly formatted but doesn't exist
    if(!bootcamp) {
        // need return statement because we have two responses within the try block
        // if we don't have the return we will get error saying header is already sent
        return next(new ErrorResponse(`Bootcamp not found with id of ${req.params.id}`, 404));
    }
    res.status(200).json({ success: true, data: bootcamp });
});

// @desc    Create new bootcamps
// @route   POST /api/v1/bootcamps
// @access  Private
exports.createBootcamp = asyncHandler(async (req, res, next) => {
    
    const bootcamp = await Bootcamp.create(req.body);

    res.status(201).json({
        success: true,
        data: bootcamp
    });

});

// @desc    Update bootcamp
// @route   PUT /api/v1/bootcamps/:id
// @access  Private
exports.updateBootcamp = asyncHandler(async (req, res, next) => {
   
    const bootcamp = await Bootcamp.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });

    if(!bootcamp){
        return next(new ErrorResponse(`Bootcamp not found with id of ${req.params.id}`, 404));
    }
    res.status(200).json({ success: true, data: bootcamp });
});

// @desc    Delete bootcamp
// @route   DELETE /api/v1/bootcamps/:id
// @access  Private
exports.deleteBootcamp = asyncHandler(async (req, res, next) => {
    const bootcamp = await Bootcamp.findById(req.params.id);

    if(!bootcamp){
        return next(new ErrorResponse(`Bootcamp not found with id of ${req.params.id}`, 404));
    }

    // Need to first find the Bootcamp via findById and then call the remove() method to delete bootcamp
    // instead of using findByIdAndDelete because it won't trigger the middleware for cascade deleting  
    // courses if bootcamp is deleted
    bootcamp.remove();

    res.status(200).json({ success: true, data: {} });
});


// @desc    Get bootcamps within a radius
// @route   GET /api/v1/bootcamps/radius/:zip/:distance
// @access  Private
exports.getBootcampsInRadius = asyncHandler(async (req, res, next) => {
    const { zipcode, distance } = req.params;

    // Get lat/long from geocoder
    const loc = await geocoder.geocode(zipcode);
    const lat = loc[0].latitude;
    const lng = loc[0].longitude;

    // Calculate radius using radians
    // Divide dist by radius of Earth
    // Earth Radius = 3,963 miles / 6,378 km
    const radius = distance / 3963;

    const bootcamps = await Bootcamp.find({
        location:{
            $geoWithin: { $centerSphere: [ [ lng, lat ], radius ] }
        }
    });

    res.status(200).json({
        success: true,
        count: bootcamps.length,
        data: bootcamps
    });

});

// @desc    Upload photo for bootcamp
// @route   PUT /api/v1/bootcamps/:id/photo
// @access  Private
exports.bootcampPhotoUpload = asyncHandler(async (req, res, next) => {
    // Find bootcamp by id
    const bootcamp = await Bootcamp.findById(req.params.id);
    // Check to see if the bootcamp exists
    if(!bootcamp){
        return next(new ErrorResponse(`Bootcamp not found with id of ${req.params.id}`, 404));
    }
    // Check if file uploaded
    if(!req.files) {
        return next(new ErrorResponse(`Please upload a file`, 400));
    }

    const file = req.files.file;

    // Make sure image is a photo
    if(!file.mimetype.startsWith('image')){
        return next(new ErrorResponse(`Please upload an image file`, 400));
    }

    // Check file size
    if(file.size > process.env.MAX_FILE_UPLOAD) {
        return next(new ErrorResponse(`Please upload an image less than ${process.env.MAX_FILE_UPLOAD}`, 400));
    }

    // Create custom filename to prevent overwriting image uploads with same name
    file.name = `photo_${bootcamp._id}${path.parse(file.name).ext}`;

    file.mv(`${process.env.FILE_UPLOAD_PATH}/${file.name}`, async err => {
        if(err) {
            console.error(err);
            return next(new ErrorResponse(`Problem with file upload`, 500));
        }

        // Insert filename into database
        await Bootcamp.findByIdAndUpdate(req.params.id, { photo: file.name });

        res.status(200).json({
            success: true,
            data: file.name
        });
    });
});