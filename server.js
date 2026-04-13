
const _404 = require('./router/404.js');
const home = require('./router/index.js');
const programApi = require('./router/api/program.js');
const adminPage = require('./router/admin.js');
const adminApi = require('./router/api/upload.js');

const express = require('express');
const app = express();
const path = require('path');
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(home);
app.use('/notice', (req, res) => {
  res.status(200).sendFile(path.join(__dirname,  'public', 'notice.html'));
});

app.use('/about', (req, res) => {
  res.status(200).sendFile(path.join(__dirname, 'public', 'about.html'));
});

app.use('/staff', (req, res) => {
  res.status(200).sendFile(path.join(__dirname, 'public', 'staff.html'));
});

app.use('/api/program',programApi);
app.use('/program', (req,res) =>{
 res.status(200).sendFile(path.join(__dirname,'public','program.html'))
});

app.use('/admin', adminPage);
app.use('/api/admin', adminApi);

app.use('/gallary', (req,res) =>{
    res.status(200).sendFile(path.join(__dirname,'public','gallary.html'))
})
app.use(_404);

app.listen(port,()=>{
    console.log(`Server is running on port http://localhost:${port}`);
});