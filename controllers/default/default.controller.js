// Server status check
exports.serverStatus = (req, res) => {
    res.status(200).json({ message: "Server is up" });
};
