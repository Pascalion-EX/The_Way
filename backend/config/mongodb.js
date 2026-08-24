import mongoose from "mongoose";
mongoose.set("sanitizeFilter", true);
mongoose.set("strictQuery", true);

const connectDB = async ()=>{

    mongoose.connection.on(`connected`,()=>console.log('Database is on'));

    await mongoose.connect(`${process.env.MONGODB_URL}/The way`);
};
export default connectDB;