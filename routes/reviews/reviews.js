const express = require('express');
const router = express.Router();

router.route("/")
    .get((req, res) => {
        console.log("GET /reviews/ - Reviews List route hit");
        res.send("All Reviews List!!");
    })
    .post((req, res) => {
        const { sender, receiver, foodRating, hygieneRating, comments, images, dateCreated } = req.body;

        console.log("POST /reviews/ - Submit new review route hit");
        console.log("Review Data:", req.body);

        // typically save the review data to a database
        
        res.status(201).send("Review submitted successfully");
    });

router.get("/host/:name", (req, res) => {
    console.log(`GET /reviews/host/${req.params.name} - Reviews by host route hit`);
    res.send(`All Reviews by Host: ${req.params.name}`);
});

router.route("/:id")
.get((req, res) => {
    console.log(`GET /reviews/${req.params.id} - Review detail route hit`);
    res.send(`Review with ID ${req.params.id} Detail`)
})
.put((req, res) => {
    console.log(`PUT /reviews/${req.params.id} - Update review route hit`);
    res.send(`Update Review ID ${req.params.id} Details`)
})
.delete((req, res) => {
    console.log(`DELETE /reviews/${req.params.id} - Delete review route hit`);
    res.send(`Delete Review ID ${req.params.id}`)
});

module.exports = router;
