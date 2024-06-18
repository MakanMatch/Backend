const express = require('express');
const router = express.Router();

router.get("/", (req, res) => {
    console.log("GET /reviews - Reviews route hit");
    res.send("Reviews!!");
});

router.get("/all", (req, res) => {
    console.log("GET /reviews/all - All reviews route hit");
    res.send("All reviews!");
});

router.post("/add", (req, res) => {
    console.log("POST /reviews/add - Add review route hit");
    res.send("Add review!");
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
})

module.exports = router;
