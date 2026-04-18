const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');
const readline = require('readline');
const bcrypt = require('bcrypt'); // Assuming you use bcrypt for password hashing

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Helper function to ask questions
const question = (query) => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

// Helper function to ask password (with hidden input)
const questionPassword = (query) => {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    stdout.write(query);

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let password = '';

    const onData = (char) => {
      char = char.toString('utf8');

      switch (char) {
        case '\n':
        case '\r':
        case '\u0004': // Ctrl-D
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          stdout.write('\n');
          resolve(password);
          break;
        case '\u0003': // Ctrl-C
          process.exit();
          break;
        case '\u007f': // Backspace
        case '\b':
          if (password.length > 0) {
            password = password.slice(0, -1);
            stdout.clearLine();
            stdout.cursorTo(0);
            stdout.write(query + '*'.repeat(password.length));
          }
          break;
        default:
          password += char;
          stdout.write('*');
          break;
      }
    };

    stdin.on('data', onData);
  });
};

// Validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const createAdmin = async () => {
  let client;

  try {
    // Connect to MongoDB
    client = new MongoClient(process.env.DATABASE_URL);
    await client.connect();

    const db = client.db(); // Uses the database from connection string
    const usersCollection = db.collection('users'); // Adjust collection name if needed

    console.log('✓ Connected to MongoDB\n');
    console.log('Creating Admin User');
    console.log('-------------------\n');

    // Get admin details from user input
    let name = '';
    while (!name || name.length < 4) {
      name = await question('Name: ');
      if (!name) {
        console.log('⚠ Name cannot be empty!');
      } else if (name.length < 4) {
        console.log('⚠ Name must be at least 4 characters long!');
        name = '';
      }
    }

    let email = '';
    while (!email || !isValidEmail(email)) {
      email = await question('Email: ');
      if (!email) {
        console.log('⚠ Email cannot be empty!');
      } else if (!isValidEmail(email)) {
        console.log('⚠ Please enter a valid email address!');
      } else {
        // Check if email already exists
        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
          console.log('⚠ A user with this email already exists!');
          email = '';
        }
      }
    }

    let password = '';
    let confirmPassword = '';
    while (!password || password !== confirmPassword || password.length < 8) {
      password = await questionPassword('Password: ');
      if (!password) {
        console.log('⚠ Password cannot be empty!');
        continue;
      }
      if (password.length < 8) {
        console.log('⚠ Password must be at least 8 characters long!');
        password = '';
        continue;
      }

      confirmPassword = await questionPassword('Confirm Password: ');
      if (password !== confirmPassword) {
        console.log('⚠ Passwords do not match!');
        password = '';
        confirmPassword = '';
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user with all required fields
    const adminData = {
      name,
      email,
      password: hashedPassword,
      avatar: null,
      isVerified: true,
      displayName: null,
      accountStatus: 'active',
      termsAndPrivacyAcceptedAt: new Date(),
      location: null,
      isTermsAndPrivacyAccepted: true,
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await usersCollection.insertOne(adminData);

    console.log('\n✓ Admin user created successfully!');
    console.log(`Email: ${email}`);
    console.log(`Name: ${name}`);
    console.log(`Role: admin`);
    console.log(`Verified: Yes`);
    console.log(`ID: ${result.insertedId}`);

    rl.close();
    await client.close();
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Error creating admin:', error.message);
    rl.close();
    if (client) {
      await client.close();
    }
    process.exit(1);
  }
};

// Run the script
createAdmin();
