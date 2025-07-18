import { Boss, Category, User } from "../models/index.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// ES modules equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getAllBosses = async (req, res) => {
  try {
    // Get user filter based on role
    const filter = req.bossFilter || {};
    
    const bosses = await Boss.findAll({
      where: filter,
      include: [
        {
          model: Category,
          as: "Categories",
          through: { attributes: [] }
        },
        {
          model: User,
          as: "creator",
          attributes: ['id', 'username', 'email']
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    res.status(200).json(bosses);
  } catch (error) {
    console.error("Error fetching bosses:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getBossById = async (req, res) => {
  const { id } = req.params;
  try {
    const boss = await Boss.findByPk(id, {
      include: [
        {
          model: Category,
          as: "Categories",
          through: { attributes: [] }
        },
        {
          model: User,
          as: "creator",
          attributes: ['id', 'username', 'email']
        }
      ]
    });
    
    if (!boss) {
      return res.status(404).json({ message: "Boss not found" });
    }
    
    // Check permissions: Host can only view their own bosses, Admin can view all
    const { role, id: userId } = req.user;
    if (role === 'host' && boss.creatorId !== userId) {
      return res.status(403).json({ message: "Access denied. You can only view your own bosses." });
    }
    
    res.status(200).json(boss);
  } catch (error) {
    console.error("Error fetching boss:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const createBoss = async (req, res) => {
  const {
    name,
    description,
    cooldownDuration,
    numberOfTeams,
    categoryIds,
  } = req.body;
  
  try {
    console.log("Creating boss with data:", {
      name,
      description,
      cooldownDuration,
      numberOfTeams,
      categoryIds,
    });

    // Parse categoryIds if it's a JSON string (from FormData)
    let parsedCategoryIds = [];
    if (categoryIds) {
      try {
        parsedCategoryIds = typeof categoryIds === 'string' ? JSON.parse(categoryIds) : categoryIds;
      } catch (parseError) {
        console.error("Error parsing categoryIds:", parseError);
        return res.status(400).json({ message: "Invalid categoryIds format" });
      }
    }

    // Handle image upload
    let imagePath = null;
    if (req.file) {
      imagePath = req.file.filename; // Store just the filename, not the full path
    }

    const newBoss = await Boss.create({
      name,
      image: imagePath,
      description,
      cooldownDuration: cooldownDuration || 60,
      numberOfTeams: numberOfTeams || 2,
      creatorId: req.user.id
    });

    // If categoryIds are provided, associate them with the new boss
    if (Array.isArray(parsedCategoryIds) && parsedCategoryIds.length > 0) {
      console.log("Associating categories:", parsedCategoryIds);

      const categories = await Category.findAll({
        where: {
          id: parsedCategoryIds,
        },
      });

      if (categories.length !== parsedCategoryIds.length) {
        return res.status(400).json({ message: "Some categories not found" });
      }

      await newBoss.setCategories(categories);
    }

    const bossWithCategories = await Boss.findByPk(newBoss.id, {
      include: [
        {
          model: Category,
          as: "Categories",
          through: { attributes: [] }
        },
        {
          model: User,
          as: "creator",
          attributes: ['id', 'username', 'email']
        }
      ],
    });

    res.status(201).json(bossWithCategories);
  } catch (error) {
    console.error("Error creating boss:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const updateBoss = async (req, res) => {
  const { id } = req.params;
  const { name, description, cooldownDuration, numberOfTeams, categoryIds } = req.body;
  
  try {
    // Parse categoryIds if it's a JSON string (from FormData)
    let parsedCategoryIds = categoryIds;
    if (categoryIds && typeof categoryIds === 'string') {
      try {
        parsedCategoryIds = JSON.parse(categoryIds);
      } catch (parseError) {
        console.error("Error parsing categoryIds:", parseError);
        return res.status(400).json({ message: "Invalid categoryIds format" });
      }
    }

    const boss = await Boss.findByPk(id);
    if (!boss) {
      return res.status(404).json({ message: "Boss not found" });
    }
    
    // Check permissions: Host can only update their own bosses, Admin can update all
    const { role, id: userId } = req.user;
    if (role === 'host' && boss.creatorId !== userId) {
      return res.status(403).json({ message: "Access denied. You can only edit your own bosses." });
    }
    
    // Handle image upload
    if (req.file) {
      // Delete old image if it exists
      if (boss.image) {
        const oldImagePath = path.join(__dirname, '../../uploads/bosses', boss.image);
        try {
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
            console.log(`Old boss image deleted: ${oldImagePath}`);
          }
        } catch (deleteError) {
          console.error(`Error deleting old boss image: ${deleteError.message}`);
          // Continue with update even if old image deletion fails
        }
      }
      boss.image = req.file.filename; // Store just the filename
      console.log(`New boss image set: ${req.file.filename}`);
    }
    
    // Update boss fields
    boss.name = name || boss.name;
    boss.description = description || boss.description;
    boss.cooldownDuration = cooldownDuration || boss.cooldownDuration;
    boss.numberOfTeams = numberOfTeams || boss.numberOfTeams;
    
    await boss.save();
    
    // Update categories if provided
    if (Array.isArray(parsedCategoryIds)) {
      if (parsedCategoryIds.length > 0) {
        const categories = await Category.findAll({
          where: { id: parsedCategoryIds }
        });
        
        if (categories.length !== parsedCategoryIds.length) {
          return res.status(400).json({ message: "Some categories not found" });
        }
        
        await boss.setCategories(categories);
      } else {
        // Clear all categories if empty array is provided
        await boss.setCategories([]);
      }
    }
    
    // Fetch updated boss with associations
    const updatedBoss = await Boss.findByPk(id, {
      include: [
        {
          model: Category,
          as: "Categories",
          through: { attributes: [] }
        },
        {
          model: User,
          as: "creator",
          attributes: ['id', 'username', 'email']
        }
      ]
    });
    
    res.status(200).json(updatedBoss);
  } catch (error) {
    console.error("Error updating boss:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const deleteBoss = async (req, res) => {
  const { id } = req.params;
  try {
    const boss = await Boss.findByPk(id);
    if (!boss) {
      return res.status(404).json({ message: "Boss not found" });
    }
    
    // Check permissions: Host can only delete their own bosses, Admin can delete all
    const { role, id: userId } = req.user;
    if (role === 'host' && boss.creatorId !== userId) {
      return res.status(403).json({ message: "Access denied. You can only delete your own bosses." });
    }
    
    // Delete associated image file if it exists
    if (boss.image) {
      const imagePath = path.join(__dirname, '../../uploads/bosses', boss.image);
      try {
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
          console.log(`Boss image deleted: ${imagePath}`);
        }
      } catch (deleteError) {
        console.error(`Error deleting boss image: ${deleteError.message}`);
        // Continue with boss deletion even if image deletion fails
      }
    }
    
    await boss.destroy();
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting boss:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export default {
  getAllBosses,
  getBossById,
  createBoss,
  updateBoss,
  deleteBoss,
};
