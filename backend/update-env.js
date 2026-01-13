#!/usr/bin/env node

/**
 * Script to update backend .env file with AI_SERVICE_URL
 * This will add or update the AI_SERVICE_URL configuration
 */

const fs = require("fs")
const path = require("path")

const envPath = path.join(__dirname, ".env")
const aiServiceUrl = "http://192.168.254.10:5100"

function updateEnvFile() {
  console.log("\n🔧 Updating backend/.env file...\n")

  let envContent = ""
  let aiServiceExists = false

  // Read existing .env file if it exists
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf8")
    const lines = envContent.split("\n")
    
    // Check if AI_SERVICE_URL already exists
    const updatedLines = lines.map(line => {
      if (line.trim().startsWith("AI_SERVICE_URL=")) {
        aiServiceExists = true
        return `AI_SERVICE_URL=${aiServiceUrl}`
      }
      return line
    })
    
    envContent = updatedLines.join("\n")
    
    if (!aiServiceExists) {
      // Add AI_SERVICE_URL if it doesn't exist
      envContent += `\n# AI Service Configuration\nAI_SERVICE_URL=${aiServiceUrl}\n`
    }
  } else {
    // Create new .env file
    console.log("⚠️  .env file not found, creating new one...")
    envContent = `# Backend Configuration
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=event_blinker
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret
JWT_EXPIRY=7d

# AI Service Configuration
AI_SERVICE_URL=${aiServiceUrl}

# Socket.io CORS
SOCKET_IO_CORS=http://localhost:3000,http://localhost:3001,http://localhost:19000,http://localhost:19001,http://192.168.254.10:19000,http://192.168.254.10:19001,exp://192.168.254.10:19000
`
  }

  // Write updated content
  fs.writeFileSync(envPath, envContent, "utf8")
  
  if (aiServiceExists) {
    console.log(`✅ Updated AI_SERVICE_URL in .env file: ${aiServiceUrl}`)
  } else {
    console.log(`✅ Added AI_SERVICE_URL to .env file: ${aiServiceUrl}`)
  }
  
  console.log("\n✅ Environment file updated successfully!\n")
}

updateEnvFile()

