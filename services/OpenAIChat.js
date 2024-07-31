const { default: OpenAI } = require('openai');
require('dotenv').config();

/**
 * OpenAIChat is a class that provides a simple interface to OpenAI's Chat API.
 * 
 * The class provides a method to initialise the OpenAI client, and a method to prompt the model with a message. The class must be initialised before prompt messages are run.
 * 
 * In the prompt method, set `insertAppContext` to `true` to insert the app context before the user message.
 * 
 * Example usage:
 * ```js
 * const initialisationResult = OpenAIChat.initialise();
 * if (initialisationResult !== true) {
 *    console.log(initialisationResult);
 *    process.exit();
 * }
 * 
 * (async () => {
 *    const message = await OpenAIChat.prompt(
 *        "What's MakanMatch?",
 *        true,
 *        [
 *            {
 *                role: "user",
 *                content: "my name is sally!"
 *            },
 *            {
 *                role: "assistant",
 *                content: "Hi Sally! How may I help you?"
 *            }
 *        ]
 *    )
 *    console.log(message.content);
 * })();
 * ```
 * 
 * @method initialise() - Initialises the OpenAI client with the API key from the environment variables. Returns true if successful, or an error message if unsuccessful.
 * @method prompt(message, insertAppContext=false, history=[]) - Prompts the OpenAI model with a message. If `insertAppContext` is true, the app context will be inserted before the user message. The `history` parameter is an array of messages that have been sent in the conversation. Returns the response from the model.
 */
class OpenAIChat {
    /**
     * @type {OpenAI}
     */
    static client;
    static model = "gpt-3.5-turbo";
    static maxTokens = 512;
    static temperature = 0.5;

    static appContext() {
        return [
            {
                role: "system",
                content: "You are a helpful customer support assistant for a communal food-sharing platform called MakanMatch. MakanMatch is a food-sharing platform deployed by the People's Association in Singapore to combat the conventional difficulty of cooking for one person, which leads to an increase in food wastage. MakanMatch's benefits are three-fold: meals are cheaper for guests, guests get to have homemade food and there is a reduction in food wastage."
            },
            {
                role: "system",
                content: "Users can sign up as hosts to invite their fellow neighbours for a meal. Hosts make food listings which are then shown on the MakanMatch homepage. Guests can then browse listings with the intuitive Google Maps UI and the neatly organised listing information and click Proceed to make reservations. Hosts specify how many portions they will be cooking and guests can reserve any number of portions, with a minimum of 1. Prices for listings are based on each portion, like $2.50 per portion. All prices are in Singapore Dollars (SGD)."
            },
            {
                role: "system",
                content: "Guests make payment through the host's PayNow QR code on the Upcoming Reservations screen. Users can navigate to the Upcoming Navigations screen by opening the sidebar through the hamburger icon at the top-left of the navigation bar. During the reservation period, hosts are able to chat with any of their guests in real-time through the chats feature. Users can navigate to the Chats screen from the sidebar as well. Up till six hours of the reservation, guests can cancel the reservation without any charges. During the six hour period prior to the listing's start time, guests have to pay a cancellation fee, which is double the price of the total reserved portions, in order to cancel. This is because cancellations so close to the start time make it inconvenient for the host."
            },
            {
                role: "system",
                content: "After a reservation, guests can leave reviews for hosts on the Makan History screen. Reviews are important as they help other guests gain confidence in the host's cooking. Reviews include a food rating, hygiene rating, comments and images as well. Users are able to change their account information, delete their account, view upcoming listings or past reservations and much more in the My Account screen, which is also accessible from the sidebar."
            },
            {
                role: "system",
                content: "Given this context, and prompts from the user, you are tasked to provide the most accurate and appropriate guidance to the user. If you don't know something, say you don't know, don't try to make it up. Try your best to keep the topic of conversation about MakanMatch only, refrain from discussing other topics, despite the user's continuous attempts."
            }
        ]
    }

    static checkPermission() {
        return process.env.OPENAI_API_KEY && process.env.OPENAI_CHAT_ENABLED === 'True';
    }

    static initialise(configOptions={ model: "gpt-3.5-turbo", maxTokens: 512, temperature: 0.5 }) {
        if (!this.checkPermission()) {
            return "ERROR: OpenAIChat operation permission denied.";
        }

        try {
            this.client = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY
            });
        } catch (err) {
            return `ERROR: OpenAIChat failed to initialise. Error; ${err}`;
        }

        if (configOptions.model) {
            this.model = configOptions.model;
        }
        if (configOptions.maxTokens) {
            this.maxTokens = configOptions.maxTokens;
        }
        if (configOptions.temperature) {
            this.temperature = configOptions.temperature;
        }

        return true;
    }

    static async prompt(message, insertAppContext=false, history=[]) {
        if (!this.checkPermission() || !this.client) {
            return "ERROR: OpenAIChat not initialised properly."
        }

        // Sanitise history
        const sanitisedMessages = []
        if (insertAppContext) {
            for (const message of this.appContext()) {
                sanitisedMessages.push(message);
            }
        }
        for (const message of history) {
            if (typeof message !== "object") {
                continue;
            } else if (!message.hasOwnProperty("role") || !message.hasOwnProperty("content")) {
                continue;
            } else if (typeof message.role !== "string" || typeof message.content !== "string") {
                continue;
            } else {
                sanitisedMessages.push(message);
            }
        }

        sanitisedMessages.push({
            role: "user",
            content: message
        })

        // Run prompt
        try {
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: sanitisedMessages,
                max_tokens: this.maxTokens,
                temperature: this.temperature
            })

            return response.choices[0].message;
        } catch (err) {
            return `ERROR: Failed to run prompt. Error: ${err}`
        }
    }
}



module.exports = OpenAIChat;